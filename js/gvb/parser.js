// ---------------------------------------------------------------------------
// Parser for GURPS Vehicle Builder (GVB) files: repositories (.rep) and
// vehicles (.gvv). These are Delphi "TPF0" binary component streams.
//
// Works in both the browser and Node (uses only Uint8Array/DataView).
// This module ships no game data — it reads files the user already owns.
// ---------------------------------------------------------------------------

const VA = {
  NULL: 0, LIST: 1, INT8: 2, INT16: 3, INT32: 4, EXTENDED: 5, STRING: 6,
  IDENT: 7, FALSE: 8, TRUE: 9, BINARY: 10, SET: 11, LSTRING: 12, NIL: 13,
  COLLECTION: 14, SINGLE: 15, CURRENCY: 16, DATE: 17, WSTRING: 18,
  INT64: 19, UTF8STRING: 20,
};

const latin1 = (bytes) => {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
};

class Reader {
  constructor(bytes) {
    this.b = bytes;
    this.dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.pos = 0;
  }
  u8() { return this.b[this.pos++]; }
  peek() { return this.b[this.pos]; }
  i8() { const v = this.dv.getInt8(this.pos); this.pos += 1; return v; }
  i16() { const v = this.dv.getInt16(this.pos, true); this.pos += 2; return v; }
  i32() { const v = this.dv.getInt32(this.pos, true); this.pos += 4; return v; }
  i64() { const v = this.dv.getBigInt64(this.pos, true); this.pos += 8; return Number(v); }
  f32() { const v = this.dv.getFloat32(this.pos, true); this.pos += 4; return v; }
  f64() { const v = this.dv.getFloat64(this.pos, true); this.pos += 8; return v; }
  bytes(n) { const v = this.b.subarray(this.pos, this.pos + n); this.pos += n; return v; }
  shortStr() { return latin1(this.bytes(this.u8())); }
  longStr() { return latin1(this.bytes(this.i32())); }
  wideStr() {
    const n = this.i32();
    let s = '';
    for (let i = 0; i < n; i++) { s += String.fromCharCode(this.dv.getUint16(this.pos, true)); this.pos += 2; }
    return s;
  }
  extended() { // 80-bit x87 float
    const b = this.bytes(10);
    const sign = b[9] & 0x80 ? -1 : 1;
    const exp = ((b[9] & 0x7f) << 8) | b[8];
    let mant = 0;
    for (let i = 7; i >= 0; i--) mant = mant * 256 + b[i];
    if (exp === 0 && mant === 0) return 0;
    if (exp === 0x7fff) return mant % 2 ** 63 ? NaN : sign * Infinity;
    return sign * mant * 2 ** (exp - 16383 - 63);
  }

  value() {
    const t = this.u8();
    switch (t) {
      case VA.NULL: return null;
      case VA.LIST: {
        const items = [];
        while (this.peek() !== VA.NULL) items.push(this.value());
        this.u8();
        return items;
      }
      case VA.INT8: return this.i8();
      case VA.INT16: return this.i16();
      case VA.INT32: return this.i32();
      case VA.EXTENDED: return this.extended();
      case VA.STRING: return this.shortStr();
      case VA.IDENT: return this.shortStr();
      case VA.FALSE: return false;
      case VA.TRUE: return true;
      case VA.BINARY: { const n = this.i32(); this.bytes(n); return { binary: n }; }
      case VA.SET: {
        const items = [];
        for (;;) {
          const s = this.shortStr();
          if (!s) break;
          items.push(s);
        }
        return items;
      }
      case VA.LSTRING: return this.longStr();
      case VA.NIL: return null;
      case VA.COLLECTION: {
        const items = [];
        while (this.peek() !== VA.NULL) {
          let order = null;
          if ([VA.INT8, VA.INT16, VA.INT32].includes(this.peek())) order = this.value();
          this.u8(); // vaList opener for item properties
          const props = {};
          while (this.peek() !== VA.NULL) props[this.shortStr()] = this.value();
          this.u8();
          items.push(order === null ? props : { order, ...props });
        }
        this.u8();
        return items;
      }
      case VA.SINGLE: return this.f32();
      case VA.CURRENCY: return this.i64() / 10000;
      case VA.DATE: return this.f64();
      case VA.WSTRING: return this.wideStr();
      case VA.INT64: return this.i64();
      case VA.UTF8STRING: return this.longStr();
      default:
        throw new Error(`Unknown value type ${t} at offset ${this.pos - 1}`);
    }
  }

  object() {
    if (this.peek() >= 0xf0) { // instance flags prefix
      const flags = this.u8() & 0x0f;
      if (flags & 0x04) this.i32(); // child position
    }
    const cls = this.shortStr();
    const name = this.shortStr();
    const props = {};
    while (this.peek() !== 0) props[this.shortStr()] = this.value();
    this.u8();
    const children = [];
    while (this.peek() !== 0) children.push(this.object());
    this.u8();
    return { class: cls, name, props, children };
  }
}

export function parseTpf0(bytes) {
  if (latin1(bytes.subarray(0, 4)) !== 'TPF0') {
    throw new Error('Not a TPF0 stream (expected a GVB .rep or .gvv file)');
  }
  const r = new Reader(bytes);
  r.pos = 4;
  return r.object();
}
