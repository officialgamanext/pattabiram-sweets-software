/**
 * ESC/POS Thermal Receipt Printer Command Generator
 * Supports 58mm (32 cols) and 80mm (48 cols) standard thermal printers
 * Compatible with WebUSB, Web Serial, and Web Bluetooth ESC/POS printers
 */

export interface ReceiptItem {
  name: string;
  qty: number;
  unit?: string;
  price: number;
  total: number;
}

export interface ReceiptData {
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  storeGst?: string;
  billNo: string;
  dateStr?: string;
  timeStr?: string;
  customerName?: string;
  customerPhone?: string;
  orderType?: string;
  paymentMode?: string;
  paymentStatus?: string;
  slot?: string;
  deliveryDate?: string;
  items: ReceiptItem[];
  subtotal: number;
  tax?: number;
  discount?: number;
  packingCharges?: number;
  additionalCharges?: number;
  boxCharges?: number;
  grandTotal: number;
  footerNote?: string;
  cashierName?: string;
}

export class EscPosBuilder {
  private buffer: number[] = [];
  private paperWidth: '58mm' | '80mm';

  constructor(paperWidth: '58mm' | '80mm' = '80mm') {
    this.paperWidth = paperWidth;
  }

  // Column width helper
  public get maxColumns(): number {
    return this.paperWidth === '58mm' ? 32 : 48;
  }

  // Initialize printer
  public init(): EscPosBuilder {
    this.buffer.push(0x1b, 0x40); // ESC @
    return this;
  }

  // Character Code Page (CP437 default)
  public setCodePage(page: number = 0): EscPosBuilder {
    this.buffer.push(0x1b, 0x74, page);
    return this;
  }

  // Text Alignment
  public alignLeft(): EscPosBuilder {
    this.buffer.push(0x1b, 0x61, 0x00);
    return this;
  }

  public alignCenter(): EscPosBuilder {
    this.buffer.push(0x1b, 0x61, 0x01);
    return this;
  }

  public alignRight(): EscPosBuilder {
    this.buffer.push(0x1b, 0x61, 0x02);
    return this;
  }

  // Text Styling
  public bold(enable: boolean = true): EscPosBuilder {
    this.buffer.push(0x1b, 0x45, enable ? 0x01 : 0x00);
    return this;
  }

  public doubleSize(enable: boolean = true): EscPosBuilder {
    this.buffer.push(0x1d, 0x21, enable ? 0x11 : 0x00); // GS ! 0x11 = double width & height
    return this;
  }

  public doubleHeight(enable: boolean = true): EscPosBuilder {
    this.buffer.push(0x1d, 0x21, enable ? 0x01 : 0x00);
    return this;
  }

  public underline(mode: 0 | 1 | 2 = 0): EscPosBuilder {
    this.buffer.push(0x1b, 0x2d, mode);
    return this;
  }

  public invert(enable: boolean = true): EscPosBuilder {
    this.buffer.push(0x1d, 0x42, enable ? 0x01 : 0x00);
    return this;
  }

  // Line Feeds & Spacing
  public feed(lines: number = 1): EscPosBuilder {
    for (let i = 0; i < lines; i++) {
      this.buffer.push(0x0a); // LF
    }
    return this;
  }

  // Append raw text
  public text(str: string): EscPosBuilder {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(str);
    for (let i = 0; i < encoded.length; i++) {
      this.buffer.push(encoded[i]);
    }
    return this;
  }

  public textLine(str: string = ''): EscPosBuilder {
    this.text(str);
    this.buffer.push(0x0a);
    return this;
  }

  // Draw separator line
  public drawLine(char: string = '-'): EscPosBuilder {
    const line = char.repeat(this.maxColumns);
    return this.textLine(line);
  }

  // Draw 2-column key-value row (e.g. "Subtotal" ............ "Rs. 450.00")
  public row2(left: string, right: string): EscPosBuilder {
    const cols = this.maxColumns;
    const spaceCount = Math.max(1, cols - left.length - right.length);
    const line = left + ' '.repeat(spaceCount) + right;
    return this.textLine(line.substring(0, cols));
  }

  // Draw 3-column row for table items (Item, Qty, Total)
  public rowItem(name: string, qtyStr: string, totalStr: string): EscPosBuilder {
    if (this.paperWidth === '58mm') {
      // 58mm: 32 columns -> Name: 16, Qty: 6, Total: 10
      const n = name.padEnd(16).substring(0, 16);
      const q = qtyStr.padStart(6).substring(0, 6);
      const t = totalStr.padStart(10).substring(0, 10);
      return this.textLine(`${n}${q}${t}`);
    } else {
      // 80mm: 48 columns -> Name: 26, Qty: 10, Total: 12
      const n = name.padEnd(26).substring(0, 26);
      const q = qtyStr.padStart(10).substring(0, 10);
      const t = totalStr.padStart(12).substring(0, 12);
      return this.textLine(`${n}${q}${t}`);
    }
  }

  // Cut Paper (Full or Partial)
  public cut(partial: boolean = false): EscPosBuilder {
    this.feed(3);
    this.buffer.push(0x1d, 0x56, partial ? 0x01 : 0x00);
    return this;
  }

  // Sound Buzzer / Beep
  public beep(times: number = 1): EscPosBuilder {
    this.buffer.push(0x1b, 0x42, Math.min(times, 5), 0x02);
    return this;
  }

  // Open Cash Drawer (if supported by printer RJ11 port)
  public openCashDrawer(): EscPosBuilder {
    this.buffer.push(0x1b, 0x70, 0x00, 0x19, 0xfa);
    return this;
  }

  // Return generated Uint8Array
  public toUint8Array(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

/**
 * Generate a complete Pattabiram Sweets Test Print ESC/POS receipt
 */
export function generateTestReceipt(paperWidth: '58mm' | '80mm' = '80mm'): Uint8Array {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const builder = new EscPosBuilder(paperWidth);

  builder
    .init()
    .alignCenter()
    .bold(true)
    .doubleSize(true)
    .textLine('PATTABIRAM SWEETS')
    .doubleSize(false)
    .bold(false)
    .textLine('Traditional Taste of Tradition')
    .textLine('Thermal Printer Test Receipt')
    .textLine('--------------------------------')
    .alignLeft()
    .textLine(`Date: ${dateStr}  Time: ${timeStr}`)
    .textLine(`Format: ESC/POS Thermal (${paperWidth})`)
    .textLine(`Port: Web USB / Bluetooth BLE`)
    .textLine(`Status: Ready & Online`)
    .drawLine('=')
    .bold(true)
    .rowItem('Item Description', 'Qty', 'Amount')
    .bold(false)
    .drawLine('-')
    .rowItem('Pattabiram Special Halwa', '1 kg', 'Rs. 480.00')
    .rowItem('Kaju Katli (Pure Ghee)', '500 g', 'Rs. 450.00')
    .rowItem('Motichoor Laddu', '1 kg', 'Rs. 320.00')
    .rowItem('Butter Murukku Mixture', '250 g', 'Rs. 110.00')
    .drawLine('-')
    .bold(true)
    .row2('Subtotal:', 'Rs. 1,360.00')
    .row2('GST (5% Included):', 'Rs. 68.00')
    .doubleHeight(true)
    .row2('TEST GRAND TOTAL:', 'Rs. 1,360.00')
    .doubleHeight(false)
    .bold(false)
    .drawLine('=')
    .alignCenter()
    .bold(true)
    .textLine('*** PRINTER HARDWARE TEST PASSED ***')
    .bold(false)
    .textLine('High Speed ESC/POS Thermal Printing')
    .textLine('Powered by Pattabiram Software')
    .feed(2)
    .cut()
    .beep(1);

  return builder.toUint8Array();
}

/**
 * Generate formatted ESC/POS bytes from bill data
 */
export function generateReceiptEscPos(
  data: ReceiptData,
  paperWidth: '58mm' | '80mm' = '80mm'
): Uint8Array {
  const builder = new EscPosBuilder(paperWidth);

  const now = new Date();
  const dateStr =
    data.dateStr ||
    now.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  const timeStr =
    data.timeStr ||
    now.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

  builder
    .init()
    .alignCenter()
    .bold(true)
    .doubleSize(true)
    .textLine(data.storeName || 'PATTABIRAM SWEETS')
    .doubleSize(false)
    .bold(false);

  if (data.storeAddress) {
    builder.textLine(data.storeAddress);
  }
  if (data.storePhone) {
    builder.textLine(`Ph: ${data.storePhone}`);
  }
  if (data.storeGst) {
    builder.textLine(`GSTIN: ${data.storeGst}`);
  }

  builder
    .drawLine('=')
    .alignLeft()
    .bold(true)
    .textLine(`Bill No: ${data.billNo}`)
    .bold(false)
    .textLine(`Date: ${dateStr}  ${timeStr}`);

  if (data.customerName || data.customerPhone) {
    builder.textLine(`Customer: ${data.customerName || 'Walk-in'} (${data.customerPhone || 'N/A'})`);
  }
  if (data.slot || data.deliveryDate) {
    const slotStr = data.slot ? `Slot: ${data.slot}` : '';
    const delivStr = data.deliveryDate ? `Delivery: ${data.deliveryDate}` : '';
    builder.textLine([slotStr, delivStr].filter(Boolean).join(' | '));
  }
  if (data.paymentMode || data.paymentStatus) {
    const payStr = data.paymentMode ? `Payment: ${data.paymentMode}` : '';
    const statusStr = data.paymentStatus ? `Status: ${data.paymentStatus}` : '';
    builder.textLine([payStr, statusStr, `Type: ${data.orderType || 'POS'}`].filter(Boolean).join(' | '));
  }

  builder
    .drawLine('-')
    .bold(true)
    .rowItem('Item', 'Qty', 'Total')
    .bold(false)
    .drawLine('-');

  // Item List
  data.items.forEach((item) => {
    const qtyText = `${item.qty}${item.unit ? ' ' + item.unit : ''}`;
    const totalText = `Rs.${item.total.toFixed(2)}`;
    builder.rowItem(item.name, qtyText, totalText);
  });

  builder
    .drawLine('-')
    .row2('Sub Total:', `Rs.${data.subtotal.toFixed(2)}`);

  if (data.discount && data.discount > 0) {
    builder.row2('Discount:', `-Rs.${data.discount.toFixed(2)}`);
  }

  if (data.tax && data.tax > 0) {
    builder.row2('Tax / GST:', `Rs.${data.tax.toFixed(2)}`);
  }

  if (data.packingCharges && data.packingCharges > 0) {
    builder.row2('Packing Charges:', `Rs.${data.packingCharges.toFixed(2)}`);
  }

  if (data.boxCharges && data.boxCharges > 0) {
    builder.row2('Box Charges:', `Rs.${data.boxCharges.toFixed(2)}`);
  }

  if (data.additionalCharges && data.additionalCharges > 0) {
    builder.row2('Other Charges:', `Rs.${data.additionalCharges.toFixed(2)}`);
  }

  builder
    .drawLine('=')
    .bold(true)
    .doubleHeight(true)
    .row2('NET AMOUNT:', `Rs.${data.grandTotal.toFixed(2)}`)
    .doubleHeight(false)
    .bold(false)
    .drawLine('=')
    .alignCenter()
    .textLine(data.footerNote || 'Thank you for visiting!')
    .textLine('Please visit again')
    .feed(2)
    .cut();

  return builder.toUint8Array();
}
