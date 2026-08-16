/**
 * ESC/POS Thermal Receipt Printer Command Generator
 * Supports 2-inch (58mm / 32 columns) and 3-inch (80mm / 48 columns) printers
 * Auto-adapts font sizing, word wrapping, tabular alignments, and totals
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
  boxCharges?: number;
  boxDetails?: string;
  stickerCharges?: number;
  shrinkCharges?: number;
  packetCharges?: number;
  packingCharges?: number;
  additionalCharges?: number;
  grandTotal: number;
  footerNote?: string;
  cashierName?: string;
}

/**
 * Word wrap helper that breaks strings cleanly at word boundaries
 */
export function wrapText(text: string, maxWidth: number): string[] {
  if (!text) return [];
  const words = text.toString().trim().split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (!currentLine) {
      if (word.length > maxWidth) {
        for (let i = 0; i < word.length; i += maxWidth) {
          lines.push(word.substring(i, i + maxWidth));
        }
      } else {
        currentLine = word;
      }
    } else if (currentLine.length + 1 + word.length <= maxWidth) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      if (word.length > maxWidth) {
        for (let i = 0; i < word.length; i += maxWidth) {
          if (i + maxWidth < word.length) {
            lines.push(word.substring(i, i + maxWidth));
          } else {
            currentLine = word.substring(i);
          }
        }
      } else {
        currentLine = word;
      }
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

export class EscPosBuilder {
  private buffer: number[] = [];
  private paperWidth: '58mm' | '80mm';

  constructor(paperWidth: '58mm' | '80mm' = '58mm') {
    this.paperWidth = paperWidth;
  }

  // Column width helper (58mm = 32 cols, 80mm = 48 cols)
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
    this.buffer.push(0x1d, 0x21, enable ? 0x01 : 0x00); // GS ! 0x01 = double height only
    return this;
  }

  public doubleWidth(enable: boolean = true): EscPosBuilder {
    this.buffer.push(0x1d, 0x21, enable ? 0x10 : 0x00); // GS ! 0x10 = double width only
    return this;
  }

  public underline(mode: 0 | 1 | 2 = 0): EscPosBuilder {
    this.buffer.push(0x1b, 0x2d, mode);
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

  // Centered text with automatic word wrapping
  public textLineCentered(str: string): EscPosBuilder {
    const lines = wrapText(str, this.maxColumns);
    for (const l of lines) {
      const pad = Math.max(0, Math.floor((this.maxColumns - l.length) / 2));
      this.textLine(' '.repeat(pad) + l);
    }
    return this;
  }

  // Left-aligned text with automatic word wrapping
  public textLineWrapped(str: string, indent: number = 0): EscPosBuilder {
    const lines = wrapText(str, this.maxColumns - indent);
    const padStr = ' '.repeat(indent);
    for (const l of lines) {
      this.textLine(padStr + l);
    }
    return this;
  }

  // Draw clean divider line
  public drawLine(char: string = '-'): EscPosBuilder {
    const line = char.repeat(this.maxColumns);
    return this.textLine(line);
  }

  // Draw 2-column key-value row with automatic right alignment & clean overflow handling
  public row2(left: string, right: string): EscPosBuilder {
    const cols = this.maxColumns;
    if (left.length + right.length + 1 <= cols) {
      const spaceCount = cols - left.length - right.length;
      return this.textLine(left + ' '.repeat(spaceCount) + right);
    } else {
      // If combined length overflows, print left on first line and right-aligned right on second line
      this.textLine(left);
      const pad = Math.max(0, cols - right.length);
      return this.textLine(' '.repeat(pad) + right);
    }
  }

  // Cut Paper
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

  // Open Cash Drawer
  public openCashDrawer(): EscPosBuilder {
    this.buffer.push(0x1b, 0x70, 0x00, 0x19, 0xfa);
    return this;
  }

  // Return Uint8Array bytes
  public toUint8Array(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

/**
 * Generate a complete Test Print ESC/POS receipt
 */
export function generateTestReceipt(paperWidth: '58mm' | '80mm' = '58mm'): Uint8Array {
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
  const is2Inch = paperWidth === '58mm';

  builder.init().alignCenter().bold(true);

  if (is2Inch) {
    builder.doubleHeight(true).textLineCentered('PATTABIRAM SWEETS').doubleHeight(false);
  } else {
    builder.doubleSize(true).textLineCentered('PATTABIRAM SWEETS').doubleSize(false);
  }

  builder
    .bold(false)
    .textLineCentered('Traditional Taste of Tradition')
    .textLineCentered(`Thermal Test (${is2Inch ? '2 Inch / 58mm' : '3 Inch / 80mm'})`)
    .drawLine('=')
    .alignLeft()
    .textLine(`Date: ${dateStr} ${timeStr}`)
    .textLine(`Port: Web USB / Bluetooth BLE`)
    .textLine(`Status: Ready & Online`)
    .drawLine('-');

  if (is2Inch) {
    // 2-inch clean header
    builder.bold(true).row2('ITEM / QTY', 'AMOUNT').bold(false).drawLine('-');
    
    // Sample items in 2-line layout
    builder.textLine('Pattabiram Special Halwa');
    builder.row2('  1 Kg @ Rs.480.00', 'Rs.480.00');

    builder.textLine('Kaju Katli (Pure Ghee)');
    builder.row2('  500 g @ Rs.900.00', 'Rs.450.00');

    builder.textLine('Butter Murukku Mixture');
    builder.row2('  250 g @ Rs.440.00', 'Rs.110.00');
  } else {
    // 3-inch 4-column layout
    builder.bold(true);
    const hName = 'ITEM DESCRIPTION'.padEnd(24).substring(0, 24);
    const hQty = 'QTY'.padStart(8).substring(0, 8);
    const hRate = 'RATE'.padStart(7).substring(0, 7);
    const hTotal = 'TOTAL'.padStart(9).substring(0, 9);
    builder.textLine(`${hName}${hQty}${hRate}${hTotal}`).bold(false).drawLine('-');

    const r1N = 'Special Halwa'.padEnd(24).substring(0, 24);
    const r1Q = '1.00 Kg'.padStart(8).substring(0, 8);
    const r1R = '480.00'.padStart(7).substring(0, 7);
    const r1T = '480.00'.padStart(9).substring(0, 9);
    builder.textLine(`${r1N}${r1Q}${r1R}${r1T}`);

    const r2N = 'Kaju Katli'.padEnd(24).substring(0, 24);
    const r2Q = '500 g'.padStart(8).substring(0, 8);
    const r2R = '900.00'.padStart(7).substring(0, 7);
    const r2T = '450.00'.padStart(9).substring(0, 9);
    builder.textLine(`${r2N}${r2Q}${r2R}${r2T}`);
  }

  builder
    .drawLine('-')
    .row2('Sub Total:', 'Rs.1040.00')
    .row2('GST (5% Included):', 'Rs.52.00')
    .drawLine('=')
    .bold(true);

  if (is2Inch) {
    builder.doubleHeight(true).row2('NET TOTAL:', 'Rs.1040.00').doubleHeight(false);
  } else {
    builder.doubleHeight(true).row2('NET TOTAL AMOUNT:', 'Rs.1040.00').doubleHeight(false);
  }

  builder
    .bold(false)
    .drawLine('=')
    .alignCenter()
    .bold(true)
    .textLineCentered('*** HARDWARE TEST PASSED ***')
    .bold(false)
    .textLineCentered('Powered by Pattabiram Software')
    .feed(2)
    .cut()
    .beep(1);

  return builder.toUint8Array();
}

/**
 * Generate formatted ESC/POS bytes from bill data
 * Auto-scales cleanly for 2-inch (58mm) and 3-inch (80mm) widths
 */
export function generateReceiptEscPos(
  data: ReceiptData,
  paperWidth: '58mm' | '80mm' = '58mm'
): Uint8Array {
  const builder = new EscPosBuilder(paperWidth);
  const is2Inch = paperWidth === '58mm';

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

  // 1. STORE HEADER
  builder.init().alignCenter().bold(true);

  if (is2Inch) {
    // 2-inch: Double height only ensures "PATTABIRAM SWEETS" fits cleanly on a single centered line
    builder.doubleHeight(true).textLineCentered(data.storeName || 'PATTABIRAM SWEETS').doubleHeight(false);
  } else {
    builder.doubleSize(true).textLineCentered(data.storeName || 'PATTABIRAM SWEETS').doubleSize(false);
  }

  builder.bold(false);

  if (data.storeAddress) {
    builder.textLineCentered(data.storeAddress);
  }
  if (data.storePhone) {
    builder.textLineCentered(`Ph: ${data.storePhone}`);
  }
  if (data.storeGst) {
    builder.textLineCentered(`GSTIN: ${data.storeGst}`);
  }

  // 2. BILL / ORDER METADATA
  builder.drawLine('=').alignLeft();

  builder.bold(true).row2(`Bill: ${data.billNo}`, `${dateStr}`).bold(false);
  builder.row2(`Time: ${timeStr}`, `Type: ${data.orderType || 'POS'}`);

  if (data.customerName || data.customerPhone) {
    const custName = data.customerName || 'Walk-in';
    const custPhone = data.customerPhone && data.customerPhone !== '-' ? data.customerPhone : '';
    if (custPhone) {
      builder.textLineWrapped(`Customer: ${custName} (${custPhone})`);
    } else {
      builder.textLineWrapped(`Customer: ${custName}`);
    }
  }

  if (data.slot || data.deliveryDate) {
    const slotText = data.slot ? `Slot: ${data.slot}` : '';
    const delivText = data.deliveryDate ? `Del: ${data.deliveryDate}` : '';
    if (slotText && delivText) {
      builder.row2(slotText, delivText);
    } else {
      builder.textLine(slotText || delivText);
    }
  }

  if (data.paymentMode || data.paymentStatus) {
    const payStr = `Pay: ${data.paymentMode || 'Cash'}`;
    const statusStr = data.paymentStatus ? `(${data.paymentStatus})` : '';
    builder.row2(`${payStr} ${statusStr}`.trim(), data.cashierName ? `Staff: ${data.cashierName}` : '');
  }

  // 3. ITEM TABLE HEADER
  builder.drawLine('-');

  if (is2Inch) {
    // 2-inch Table Header: 2-line layout
    builder.bold(true).row2('ITEM / QTY & RATE', 'TOTAL').bold(false).drawLine('-');

    // Line items in 2-line layout
    data.items.forEach((item) => {
      builder.textLineWrapped(item.name);
      const unitStr = item.unit ? ` ${item.unit}` : '';
      const priceStr = item.price > 0 ? ` @ Rs.${item.price.toFixed(2)}` : '';
      const qtyLine = `  ${item.qty}${unitStr}${priceStr}`;
      const totalStr = `Rs.${item.total.toFixed(2)}`;
      builder.row2(qtyLine, totalStr);
    });
  } else {
    // 3-inch Table Header: 4-column layout
    builder.bold(true);
    const hName = 'ITEM DESCRIPTION'.padEnd(24).substring(0, 24);
    const hQty = 'QTY'.padStart(8).substring(0, 8);
    const hRate = 'RATE'.padStart(7).substring(0, 7);
    const hTotal = 'TOTAL'.padStart(9).substring(0, 9);
    builder.textLine(`${hName}${hQty}${hRate}${hTotal}`).bold(false).drawLine('-');

    data.items.forEach((item) => {
      const unitStr = item.unit ? ` ${item.unit}` : '';
      const qtyText = `${item.qty}${unitStr}`;
      const rateText = item.price > 0 ? item.price.toFixed(2) : '—';
      const totalText = item.total.toFixed(2);

      // If name is long, print on first line, then aligned values
      if (item.name.length > 22) {
        builder.textLine(item.name);
        const padSpace = ' '.repeat(24);
        const colQ = qtyText.padStart(8).substring(0, 8);
        const colR = rateText.padStart(7).substring(0, 7);
        const colT = totalText.padStart(9).substring(0, 9);
        builder.textLine(`${padSpace}${colQ}${colR}${colT}`);
      } else {
        const colN = item.name.padEnd(24).substring(0, 24);
        const colQ = qtyText.padStart(8).substring(0, 8);
        const colR = rateText.padStart(7).substring(0, 7);
        const colT = totalText.padStart(9).substring(0, 9);
        builder.textLine(`${colN}${colQ}${colR}${colT}`);
      }
    });
  }

  // 4. TOTALS & CHARGES BREAKDOWN
  builder.drawLine('-');

  builder.row2('Sub Total:', `Rs.${data.subtotal.toFixed(2)}`);

  if (data.boxCharges && data.boxCharges > 0) {
    const boxLbl = data.boxDetails ? `Box Charges (${data.boxDetails}):` : 'Box Charges:';
    builder.row2(boxLbl, `+Rs.${data.boxCharges.toFixed(2)}`);
  }

  if (data.stickerCharges && data.stickerCharges > 0) {
    builder.row2('Sticker Charges:', `+Rs.${data.stickerCharges.toFixed(2)}`);
  }

  if (data.shrinkCharges && data.shrinkCharges > 0) {
    builder.row2('Shrink Charges:', `+Rs.${data.shrinkCharges.toFixed(2)}`);
  }

  if (data.packetCharges && data.packetCharges > 0) {
    builder.row2('Packet Charges:', `+Rs.${data.packetCharges.toFixed(2)}`);
  }

  if (data.packingCharges && data.packingCharges > 0) {
    builder.row2('Packing Charges:', `+Rs.${data.packingCharges.toFixed(2)}`);
  }

  if (data.additionalCharges && data.additionalCharges > 0) {
    builder.row2('Additional Charges:', `+Rs.${data.additionalCharges.toFixed(2)}`);
  }

  if (data.discount && data.discount > 0) {
    builder.row2('Discount:', `-Rs.${data.discount.toFixed(2)}`);
  }

  if (data.tax && data.tax > 0) {
    builder.row2('Tax / GST:', `+Rs.${data.tax.toFixed(2)}`);
  }

  // 5. GRAND NET AMOUNT
  builder.drawLine('=').bold(true);

  if (is2Inch) {
    // 2-inch: Bold and double height fits cleanly on 1 single line
    builder.doubleHeight(true).row2('NET AMOUNT:', `Rs.${data.grandTotal.toFixed(2)}`).doubleHeight(false);
  } else {
    builder.doubleHeight(true).row2('NET GRAND TOTAL:', `Rs.${data.grandTotal.toFixed(2)}`).doubleHeight(false);
  }

  builder.bold(false).drawLine('=');

  // 6. FOOTER
  builder
    .alignCenter()
    .textLineCentered(data.footerNote || 'Thank you for visiting!')
    .textLineCentered('Please visit again')
    .feed(2)
    .cut();

  return builder.toUint8Array();
}
