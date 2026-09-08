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
  note?: string;
}

export interface ReceiptData {
  storeName?: string;
  storeTagline?: string;
  storeAddress?: string;
  storePhone?: string;
  storeEmail?: string;
  storeGst?: string;
  storeFssai?: string;
  storeWebsite?: string;
  billNo: string;
  dateStr?: string;
  timeStr?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  orderType?: string;
  orderStatus?: string;
  paymentMode?: string;
  paymentStatus?: string;
  splitCash?: number;
  splitUpi?: number;
  cashGiven?: number;
  balanceReturn?: number;
  slot?: string;
  deliveryDate?: string;
  deliveryTime?: string;
  deliveryAddress?: string;
  isCustomisation?: boolean;
  customisationDetails?: {
    noOfBoxes?: number;
    boxType?: string;
    boxPrice?: number;
    hasShrink?: boolean;
    shrinkType?: string;
    shrinkPrice?: number;
    hasSticker?: boolean;
    stickerType?: string;
    stickerPrice?: number;
    selectedSweets?: Array<{ itemName?: string; name?: string; count?: number; weight?: number; unit?: string }>;
    remarks?: string;
  };
  items: ReceiptItem[];
  subtotal: number;
  tax?: number;
  discount?: number;
  roundOff?: number;
  boxCharges?: number;
  boxDetails?: string;
  stickerCharges?: number;
  shrinkCharges?: number;
  packetCharges?: number;
  packingCharges?: number;
  additionalCharges?: number;
  transportCharges?: number;
  grandTotal: number;
  receivedAmount?: number;
  creditAmount?: number;
  advanceAmount?: number;
  balanceAmount?: number;
  remarks?: string;
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

  constructor(paperWidth: '58mm' | '80mm' = '80mm') {
    this.paperWidth = paperWidth;
  }

  // Column width helper (58mm = 32 cols, 80mm = 48 cols)
  public get maxColumns(): number {
    return this.paperWidth === '58mm' ? 32 : 48;
  }

  // Initialize printer
  public init(): EscPosBuilder {
    this.buffer.push(0x1b, 0x40); // ESC @
    this.alignLeft();
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
  paperWidth: '58mm' | '80mm' = '80mm'
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
  builder.init().bold(true);

  const storeName = data.storeName || 'PATTABIRAM SWEETS';
  if (is2Inch) {
    builder.doubleHeight(true).textLineCentered(storeName).doubleHeight(false);
  } else {
    if (storeName.length <= 24) {
      builder.doubleSize(true).textLineCentered(storeName).doubleSize(false);
    } else {
      builder.doubleHeight(true).textLineCentered(storeName).doubleHeight(false);
    }
  }

  builder.bold(false);

  if (data.storeTagline) {
    builder.textLineCentered(data.storeTagline);
  }
  if (data.storeAddress) {
    builder.textLineCentered(data.storeAddress);
  }
  if (data.storePhone) {
    builder.textLineCentered(`Ph: ${data.storePhone}`);
  }
  if (data.storeEmail) {
    builder.textLineCentered(`Email: ${data.storeEmail}`);
  }
  if (data.storeGst) {
    builder.textLineCentered(`GSTIN: ${data.storeGst}`);
  }
  if (data.storeFssai) {
    builder.textLineCentered(`FSSAI: ${data.storeFssai}`);
  }
  if (data.storeWebsite) {
    builder.textLineCentered(`Web: ${data.storeWebsite}`);
  }

  // 2. BILL / ORDER METADATA
  builder.drawLine('=').alignLeft();

  builder.bold(true).row2(`Bill: ${data.billNo}`, `${dateStr}`).bold(false);
  builder.row2(`Time: ${timeStr}`, `Type: ${data.orderType || 'Walk-in POS'}`);

  // Customer Information
  if (data.customerName || data.customerPhone) {
    const custName = data.customerName || 'Walk-in Customer';
    const custPhone = data.customerPhone && data.customerPhone !== '-' ? ` (${data.customerPhone})` : '';
    builder.textLineWrapped(`Customer: ${custName}${custPhone}`);
  }
  if (data.customerEmail) {
    builder.textLineWrapped(`Email: ${data.customerEmail}`);
  }
  if (data.customerAddress) {
    builder.textLineWrapped(`Customer Addr: ${data.customerAddress}`);
  }

  // Delivery & Schedule Information (for orders)
  if (data.deliveryDate || data.slot || data.deliveryTime) {
    const dDate = data.deliveryDate ? `Delivery: ${data.deliveryDate}` : '';
    const sTime = data.slot ? `Slot: ${data.slot}` : (data.deliveryTime ? `Time: ${data.deliveryTime}` : '');
    if (dDate && sTime) {
      builder.row2(dDate, sTime);
    } else if (dDate || sTime) {
      builder.textLine(dDate || sTime);
    }
  }
  if (data.deliveryAddress) {
    builder.textLineWrapped(`Delivery Addr: ${data.deliveryAddress}`);
  }

  // Payment Mode & Staff
  const payStr = `Pay: ${data.paymentMode || 'Cash'}${data.paymentStatus ? ` (${data.paymentStatus})` : ''}`;
  const staffStr = data.cashierName ? `Staff: ${data.cashierName}` : '';
  if (staffStr) {
    builder.row2(payStr, staffStr);
  } else {
    builder.textLine(payStr);
  }

  // Split payment breakdown if present
  if (data.splitCash !== undefined || data.splitUpi !== undefined) {
    const sCash = (data.splitCash || 0).toFixed(2);
    const sUpi = (data.splitUpi || 0).toFixed(2);
    builder.row2('Split Details:', `Cash: Rs.${sCash} | UPI: Rs.${sUpi}`);
  }

  // Order Status if not completed
  if (data.orderStatus && data.orderStatus !== 'Delivered' && data.orderStatus !== 'Completed') {
    builder.row2('Order Status:', data.orderStatus);
  }

  // 3. CUSTOM BOX ORDER DETAILS (if customised)
  if (data.isCustomisation || data.customisationDetails) {
    builder.drawLine('-');
    builder.bold(true).textLine('CUSTOM BOX PACKING DETAILS:').bold(false);
    const cd = data.customisationDetails;
    if (cd?.noOfBoxes) {
      builder.row2('Boxes Count:', `${cd.noOfBoxes} Box(es) @ Rs.${(cd.boxPrice || 0).toFixed(2)}`);
    }
    if (cd?.boxType) {
      builder.row2('Box Type:', cd.boxType);
    }
    if (cd?.selectedSweets && cd.selectedSweets.length > 0) {
      cd.selectedSweets.forEach((s) => {
        const sName = s.itemName || s.name || 'Sweet';
        const sQty = s.count ? `${s.count} pcs` : (s.weight ? `${s.weight} ${s.unit || 'g'}` : '');
        builder.textLine(`  - ${sName}${sQty ? ` (${sQty})` : ''}`);
      });
    }
    if (cd?.hasShrink) {
      builder.row2('Shrink Wrap:', cd.shrinkType ? `${cd.shrinkType} (+Rs.${(cd.shrinkPrice || 0).toFixed(2)})` : `+Rs.${(cd.shrinkPrice || 0).toFixed(2)}`);
    }
    if (cd?.hasSticker) {
      builder.row2('Sticker / Label:', cd.stickerType ? `${cd.stickerType} (+Rs.${(cd.stickerPrice || 0).toFixed(2)})` : `+Rs.${(cd.stickerPrice || 0).toFixed(2)}`);
    }
  }

  // 4. ITEM TABLE HEADER
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
      if (item.note) {
        builder.textLine(`  * ${item.note}`);
      }
    });
  } else {
    // 3-inch (80mm) Table Header: 4-column layout (22 + 8 + 8 + 10 = 48 columns)
    builder.bold(true);
    const hName = 'ITEM DESCRIPTION'.padEnd(22).substring(0, 22);
    const hQty = 'QTY'.padStart(8).substring(0, 8);
    const hRate = 'RATE'.padStart(8).substring(0, 8);
    const hTotal = 'TOTAL'.padStart(10).substring(0, 10);
    builder.textLine(`${hName}${hQty}${hRate}${hTotal}`).bold(false).drawLine('-');

    data.items.forEach((item) => {
      const unitStr = item.unit ? ` ${item.unit}` : '';
      const qtyText = `${item.qty}${unitStr}`;
      const rateText = item.price > 0 ? item.price.toFixed(2) : '—';
      const totalText = item.total.toFixed(2);

      const colQ = qtyText.padStart(8).substring(0, 8);
      const colR = rateText.padStart(8).substring(0, 8);
      const colT = totalText.padStart(10).substring(0, 10);

      // If name is long, print on first line, then aligned values
      if (item.name.length > 22) {
        builder.textLine(item.name);
        const padSpace = ' '.repeat(22);
        builder.textLine(`${padSpace}${colQ}${colR}${colT}`);
      } else {
        const colN = item.name.padEnd(22).substring(0, 22);
        builder.textLine(`${colN}${colQ}${colR}${colT}`);
      }
      if (item.note) {
        builder.textLine(`  * ${item.note}`);
      }
    });
  }

  // 5. TOTALS & CHARGES BREAKDOWN
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

  if (data.transportCharges && data.transportCharges > 0) {
    builder.row2('Transport Charges:', `+Rs.${data.transportCharges.toFixed(2)}`);
  }

  if (data.discount && data.discount > 0) {
    builder.row2('Discount:', `-Rs.${data.discount.toFixed(2)}`);
  }

  if (data.tax && data.tax > 0) {
    builder.row2('Tax / GST:', `+Rs.${data.tax.toFixed(2)}`);
  }

  if (data.roundOff !== undefined && data.roundOff !== 0) {
    const rPrefix = data.roundOff > 0 ? '+Rs.' : '-Rs.';
    builder.row2('Round Off:', `${rPrefix}${Math.abs(data.roundOff).toFixed(2)}`);
  }

  // 6. GRAND NET AMOUNT
  builder.drawLine('=').bold(true);

  if (is2Inch) {
    builder.doubleHeight(true).row2('NET AMOUNT:', `Rs.${data.grandTotal.toFixed(2)}`).doubleHeight(false);
  } else {
    builder.doubleHeight(true).row2('NET AMOUNT:', `Rs.${data.grandTotal.toFixed(2)}`).doubleHeight(false);
  }

  builder.bold(false).drawLine('=');

  // 7. PAYMENT, CASH TENDERED, CHANGE, CREDIT DUE BREAKDOWN
  if (data.receivedAmount !== undefined) {
    builder.row2('Total Paid / Received:', `Rs.${data.receivedAmount.toFixed(2)}`);
  }

  if (data.cashGiven && data.cashGiven > 0) {
    builder.row2('Cash Tendered:', `Rs.${data.cashGiven.toFixed(2)}`);
  }

  if (data.balanceReturn && data.balanceReturn > 0) {
    builder.bold(true).row2('Change Returned:', `Rs.${data.balanceReturn.toFixed(2)}`).bold(false);
  }

  if (data.advanceAmount && data.advanceAmount > 0) {
    builder.row2('Advance Paid:', `Rs.${data.advanceAmount.toFixed(2)}`);
  }

  if (data.balanceAmount && data.balanceAmount > 0) {
    builder.bold(true).row2('BALANCE DUE ON DELIVERY:', `Rs.${data.balanceAmount.toFixed(2)}`).bold(false);
  }

  if (data.creditAmount && data.creditAmount > 0) {
    builder.bold(true).row2('CREDIT / BALANCE DUE:', `Rs.${data.creditAmount.toFixed(2)}`).bold(false);
  }

  // 8. SPECIAL INSTRUCTIONS / REMARKS
  if (data.remarks) {
    builder.drawLine('-');
    builder.bold(true).textLine('Special Instructions:').bold(false);
    builder.textLineWrapped(data.remarks);
  }

  // 9. FOOTER
  builder.drawLine('-');
  builder
    .alignCenter()
    .textLineCentered(data.footerNote || 'Thank you for choosing Pattabiram Sweets! Visit again!')
    .textLineCentered('Please visit again')
    .feed(3)
    .cut();

  return builder.toUint8Array();
}
