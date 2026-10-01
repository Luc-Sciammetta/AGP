// Minimal RFC 6455 WebSocket server side for node:http 'upgrade' (no dependencies, no extensions).
// Handshake, masked client frames, 7/16/64-bit lengths, fragmentation, ping/pong, close. Server frames are unmasked.
// Realtime-friendly: TCP_NODELAY, and sendVolatile() drops a frame instead of queueing when the socket is backed up.
import crypto from 'node:crypto';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_PAYLOAD = 512 * 1024;           // bytes per message (ghost uploads are the largest, ~20-60 KB)
const BACKLOG = 128 * 1024;               // bytes queued in the socket before volatile frames are dropped

export function acceptUpgrade(req, socket, head, onOpen) {
  const key = req.headers['sec-websocket-key'];
  const up = String(req.headers.upgrade || '').toLowerCase();
  if (up !== 'websocket' || !key || req.headers['sec-websocket-version'] !== '13') {
    socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
    return null;
  }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  socket.setNoDelay(true);
  socket.setKeepAlive(true, 20000);
  const ws = new WSConn(socket, req);
  onOpen(ws);
  if (head && head.length) ws._data(head);
  return ws;
}

export class WSConn {
  constructor(socket, req) {
    this.socket = socket;
    this.addr = (req && (req.headers['x-forwarded-for'] || req.socket.remoteAddress)) || '';
    this.buf = null; this.frags = []; this.fragOp = 0; this.fragLen = 0;
    this.open = true; this.onmessage = null; this.onclose = null;
    this.bytesIn = 0; this.bytesOut = 0; this.msgsIn = 0; this.msgsOut = 0; this.dropped = 0; this.lastIn = Date.now();
    socket.on('data', d => this._data(d));
    socket.on('close', () => this._closed(1006));
    socket.on('error', () => this._closed(1006));
    socket.on('end', () => this._closed(1006));
  }
  _data(d) {
    this.bytesIn += d.length; this.lastIn = Date.now();
    this.buf = this.buf && this.buf.length ? Buffer.concat([this.buf, d]) : d;
    let b = this.buf, off = 0;
    while (this.open) {
      if (b.length - off < 2) break;
      const b0 = b[off], b1 = b[off + 1], fin = (b0 & 0x80) !== 0, op = b0 & 0x0f, masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f, p = off + 2;
      if (len === 126) { if (b.length - off < 4) break; len = b.readUInt16BE(off + 2); p = off + 4; }
      else if (len === 127) { if (b.length - off < 10) break; const big = b.readBigUInt64BE(off + 2); if (big > BigInt(MAX_PAYLOAD)) return this.close(1009, 'too big'); len = Number(big); p = off + 10; }
      if (len > MAX_PAYLOAD) return this.close(1009, 'too big');
      if (!masked) return this.close(1002, 'unmasked client frame');
      if (b.length - p < 4 + len) break;
      const mask = b.subarray(p, p + 4), data = Buffer.allocUnsafe(len);
      for (let i = 0, q = p + 4; i < len; i++) data[i] = b[q + i] ^ mask[i & 3];
      off = p + 4 + len;
      this._frame(fin, op, data);
    }
    this.buf = off >= b.length ? null : b.subarray(off);
  }
  _frame(fin, op, data) {
    if (op >= 8) {   // control frames
      if (op === 8) { const code = data.length >= 2 ? data.readUInt16BE(0) : 1000; this._write(8, data.subarray(0, 2)); this._closed(code); try { this.socket.end(); } catch (e) {} }
      else if (op === 9) this._write(10, data);
      return;
    }
    if (op === 0) {   // continuation
      if (!this.fragOp) return this.close(1002, 'bad continuation');
      this.frags.push(data); this.fragLen += data.length;
      if (this.fragLen > MAX_PAYLOAD) return this.close(1009, 'too big');
      if (!fin) return;
      const all = Buffer.concat(this.frags); const o = this.fragOp;
      this.frags = []; this.fragOp = 0; this.fragLen = 0;
      return this._deliver(o, all);
    }
    if (!fin) { this.fragOp = op; this.frags = [data]; this.fragLen = data.length; return; }
    this._deliver(op, data);
  }
  _deliver(op, data) {
    this.msgsIn++;
    if (!this.onmessage) return;
    try { this.onmessage(op === 1 ? data.toString('utf8') : data, op !== 1); }
    catch (e) { console.error('[ws] handler error', e); }
  }
  _write(op, payload) {
    if (!this.open || this.socket.destroyed) return false;
    const len = payload.length, hl = len < 126 ? 2 : len < 65536 ? 4 : 10;
    const f = Buffer.allocUnsafe(hl + len);
    f[0] = 0x80 | op;
    if (hl === 2) f[1] = len;
    else if (hl === 4) { f[1] = 126; f.writeUInt16BE(len, 2); }
    else { f[1] = 127; f.writeBigUInt64BE(BigInt(len), 2); }
    if (Buffer.isBuffer(payload)) payload.copy(f, hl); else f.set(payload, hl);
    this.bytesOut += f.length; this.msgsOut++;
    return this.socket.write(f);
  }
  send(data) {
    if (typeof data === 'string') return this._write(1, Buffer.from(data, 'utf8'));
    return this._write(2, data instanceof Uint8Array ? data : Buffer.from(data));
  }
  // realtime frames (snapshots): dropped rather than queued behind a slow link, so latency never builds up
  sendVolatile(data) {
    if (this.socket.writableLength > BACKLOG) { this.dropped++; return false; }
    return this.send(data);
  }
  close(code = 1000, reason = '') {
    if (!this.open) return;
    const r = Buffer.from(String(reason).slice(0, 100)), p = Buffer.allocUnsafe(2 + r.length);
    p.writeUInt16BE(code, 0); r.copy(p, 2);
    this._write(8, p);
    this._closed(code);
    setTimeout(() => { try { this.socket.destroy(); } catch (e) {} }, 200);
  }
  _closed(code) {
    if (!this.open) return;
    this.open = false;
    if (this.onclose) { try { this.onclose(code); } catch (e) { console.error('[ws] close handler error', e); } }
  }
}
