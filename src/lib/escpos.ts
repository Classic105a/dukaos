// ESC/POS Commands for thermal printers
// Supports XPrinter, Epson TM Series, and generic ESC/POS printers

export const ESC = '\x1B';
export const GS = '\x1D';
export const FS = '\x1C';

// Printer commands
export const COMMANDS = {
  // Initialize printer
  INIT: `${ESC}@`,
  
  // Text formatting
  BOLD_ON: `${ESC}E\x01`,
  BOLD_OFF: `${ESC}E\x00`,
  UNDERLINE_ON: `${ESC}-\x01`,
  UNDERLINE_OFF: `${ESC}-\x00`,
  DOUBLE_HEIGHT_ON: `${GS}!\x10`,
  DOUBLE_WIDTH_ON: `${GS}!\x20`,
  DOUBLE_SIZE_ON: `${GS}!0`,
  NORMAL_SIZE: `${GS}!\x00`,
  
  // Text alignment
  ALIGN_LEFT: `${ESC}a\x00`,
  ALIGN_CENTER: `${ESC}a\x01`,
  ALIGN_RIGHT: `${ESC}a\x02`,
  
  // Line spacing
  LINE_SPACING_DEFAULT: `${ESC}2`,
  LINE_SPACING_SET: (n: number) => `${ESC}3${String.fromCharCode(n)}`,
  
  // Paper
  FEED_LINES: (n: number) => `${ESC}d${String.fromCharCode(n)}`,
  CUT_PAPER: `${GS}V\x00`,
  CUT_PAPER_PARTIAL: `${GS}V\x01`,
  
  // Cash drawer
  OPEN_DRAWER: `${ESC}p\x00\x19\xFA`,
  
  // Barcode commands
  BARCODE_HEIGHT: (h: number) => `${GS}h${String.fromCharCode(h)}`,
  BARCODE_WIDTH: (w: number) => `${GS}w${String.fromCharCode(w)}`,
  BARCODE_TEXT_BELOW: `${GS}H\x02`,
  BARCODE_TEXT_NONE: `${GS}H\x00`,
  // Barcode types: CODE39=4, CODE128=73
  BARCODE_CODE128: (data: string) => `${GS}k${String.fromCharCode(73)}${String.fromCharCode(data.length)}${data}`,
  BARCODE_CODE39: (data: string) => `${GS}k${String.fromCharCode(4)}${data}\x00`,
  
  // QR Code commands (GS ( k)
  QRCODE_MODEL: `${GS}(k\x04\x00\x31\x41\x32\x00`, // Model 2
  QRCODE_SIZE: (size: number) => `${GS}(k\x03\x00\x31\x43${String.fromCharCode(size)}`,
  QRCODE_ERROR_CORRECTION: `${GS}(k\x03\x00\x31\x45\x31`, // Level L (7%)
  QRCODE_STORE: (data: string) => {
    const len = data.length + 3;
    const pL = len % 256;
    const pH = Math.floor(len / 256);
    return `${GS}(k${String.fromCharCode(pL)}${String.fromCharCode(pH)}\x31\x50\x30${data}`;
  },
  QRCODE_PRINT: `${GS}(k\x03\x00\x31\x51\x30`,
};

export interface PrinterConfig {
  paperWidth: 58 | 80;
  charactersPerLine: number;
  brand: 'xprinter' | 'epson' | 'generic';
}

export interface ReceiptData {
  header: {
    businessName?: string;
    branchName?: string;
    address?: string;
    city?: string;
    phone?: string;
    email?: string;
    website?: string;
    mpesaTill?: string;
    mpesaPaybill?: string;
    mpesaAccount?: string;
    kraPin?: string;
  };
  receiptNumber: string;
  date: Date;
  cashierName?: string;
  customerName?: string;
  isReprint?: boolean;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    sku?: string;
    tax?: number;
  }>;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  payments: Array<{
    method: string;
    amount: number;
    reference?: string;
  }>;
  cashReceived?: number;
  changeGiven?: number;
  footer?: {
    message?: string;
    returnPolicy?: string;
  };
}

export interface ReceiptSettings {
  showLogo: boolean;
  showBusinessName: boolean;
  showBranchName: boolean;
  showAddress: boolean;
  showPhone: boolean;
  showEmail: boolean;
  showWebsite: boolean;
  showMpesaTill: boolean;
  showMpesaPaybill: boolean;
  showKraPin: boolean;
  showCashierName: boolean;
  showCustomerName: boolean;
  showDateTime: boolean;
  showReceiptNumber: boolean;
  showItemSku: boolean;
  showItemTax: boolean;
  showSubtotal: boolean;
  showTotalTax: boolean;
  showDiscount: boolean;
  showFooterMessage: boolean;
  footerMessage: string;
  showReturnPolicy: boolean;
  returnPolicy: string;
  showBarcode: boolean;
  showQrCode: boolean;
  barcodeType: 'code128' | 'code39' | 'qrcode';
}

const defaultSettings: ReceiptSettings = {
  showLogo: true,
  showBusinessName: true,
  showBranchName: true,
  showAddress: true,
  showPhone: true,
  showEmail: false,
  showWebsite: false,
  showMpesaTill: true,
  showMpesaPaybill: true,
  showKraPin: true,
  showCashierName: true,
  showCustomerName: true,
  showDateTime: true,
  showReceiptNumber: true,
  showItemSku: false,
  showItemTax: false,
  showSubtotal: true,
  showTotalTax: true,
  showDiscount: true,
  showFooterMessage: true,
  footerMessage: 'Thank you for your business!',
  showReturnPolicy: false,
  returnPolicy: '',
  showBarcode: true,
  showQrCode: false,
  barcodeType: 'code128',
};

// Format currency
const formatCurrency = (amount: number): string => {
  return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Pad/align text for receipt
const padText = (left: string, right: string, width: number): string => {
  const spaces = width - left.length - right.length;
  return left + ' '.repeat(Math.max(1, spaces)) + right;
};

// Center text
const centerText = (text: string, width: number): string => {
  const padding = Math.floor((width - text.length) / 2);
  return ' '.repeat(Math.max(0, padding)) + text;
};

// Generate divider
const divider = (width: number, char = '-'): string => char.repeat(width);

// Build receipt text for ESC/POS
export const buildReceiptText = (
  data: ReceiptData,
  settings: Partial<ReceiptSettings> = {},
  config: PrinterConfig = { paperWidth: 80, charactersPerLine: 48, brand: 'generic' }
): string => {
  const s = { ...defaultSettings, ...settings };
  const width = config.charactersPerLine;
  let receipt = '';
  
  // Initialize
  receipt += COMMANDS.INIT;
  receipt += COMMANDS.ALIGN_CENTER;
  
  // Header - Business Name
  if (s.showBusinessName && data.header.businessName) {
    receipt += COMMANDS.DOUBLE_SIZE_ON;
    receipt += data.header.businessName + '\n';
    receipt += COMMANDS.NORMAL_SIZE;
  }
  
  // Branch Name
  if (s.showBranchName && data.header.branchName) {
    receipt += COMMANDS.BOLD_ON;
    receipt += data.header.branchName + '\n';
    receipt += COMMANDS.BOLD_OFF;
  }
  
  // Address
  if (s.showAddress && data.header.address) {
    receipt += data.header.address + '\n';
    if (data.header.city) {
      receipt += data.header.city + '\n';
    }
  }
  
  // Phone
  if (s.showPhone && data.header.phone) {
    receipt += `Tel: ${data.header.phone}\n`;
  }
  
  // Email
  if (s.showEmail && data.header.email) {
    receipt += data.header.email + '\n';
  }
  
  // Website
  if (s.showWebsite && data.header.website) {
    receipt += data.header.website + '\n';
  }
  
  // Payment Details
  if (s.showMpesaTill && data.header.mpesaTill) {
    receipt += `M-Pesa Till: ${data.header.mpesaTill}\n`;
  }
  if (s.showMpesaPaybill && data.header.mpesaPaybill) {
    receipt += `Paybill: ${data.header.mpesaPaybill}`;
    if (data.header.mpesaAccount) {
      receipt += ` Acc: ${data.header.mpesaAccount}`;
    }
    receipt += '\n';
  }
  
  // KRA PIN
  if (s.showKraPin && data.header.kraPin) {
    receipt += `KRA PIN: ${data.header.kraPin}\n`;
  }
  
  receipt += divider(width) + '\n';
  receipt += COMMANDS.ALIGN_LEFT;
  
  // Receipt info
  if (s.showReceiptNumber) {
    receipt += `Receipt: ${data.receiptNumber}\n`;
  }
  if (s.showDateTime) {
    receipt += `Date: ${data.date.toLocaleDateString('en-KE')} ${data.date.toLocaleTimeString('en-KE')}\n`;
  }
  if (s.showCashierName && data.cashierName) {
    receipt += `Cashier: ${data.cashierName}\n`;
  }
  if (s.showCustomerName && data.customerName) {
    receipt += `Customer: ${data.customerName}\n`;
  }
  
  receipt += divider(width) + '\n';
  
  // Items header
  receipt += COMMANDS.BOLD_ON;
  receipt += padText('Item', 'Amount', width) + '\n';
  receipt += COMMANDS.BOLD_OFF;
  receipt += divider(width) + '\n';
  
  // Items
  for (const item of data.items) {
    let itemLine = item.name;
    if (s.showItemSku && item.sku) {
      itemLine += ` (${item.sku})`;
    }
    receipt += itemLine + '\n';
    
    const qtyPrice = `  ${item.quantity} x ${formatCurrency(item.unitPrice)}`;
    receipt += padText(qtyPrice, formatCurrency(item.totalPrice), width) + '\n';
    
    if (s.showItemTax && item.tax && item.tax > 0) {
      receipt += `    Tax: ${formatCurrency(item.tax)}\n`;
    }
  }
  
  receipt += divider(width) + '\n';
  
  // Totals
  if (s.showSubtotal) {
    receipt += padText('Subtotal:', formatCurrency(data.subtotal), width) + '\n';
  }
  if (s.showTotalTax && data.taxAmount > 0) {
    receipt += padText('Tax:', formatCurrency(data.taxAmount), width) + '\n';
  }
  if (s.showDiscount && data.discountAmount > 0) {
    receipt += padText('Discount:', `-${formatCurrency(data.discountAmount)}`, width) + '\n';
  }
  
  receipt += divider(width, '=') + '\n';
  receipt += COMMANDS.BOLD_ON;
  receipt += COMMANDS.DOUBLE_SIZE_ON;
  receipt += padText('TOTAL:', formatCurrency(data.totalAmount), width) + '\n';
  receipt += COMMANDS.NORMAL_SIZE;
  receipt += COMMANDS.BOLD_OFF;
  receipt += divider(width, '=') + '\n';
  
  // Payments
  receipt += '\nPayment Method(s):\n';
  for (const payment of data.payments) {
    let paymentLine = `  ${payment.method}: ${formatCurrency(payment.amount)}`;
    if (payment.reference) {
      paymentLine += ` (${payment.reference})`;
    }
    receipt += paymentLine + '\n';
  }

  // Cash tendered / change (only for cash payments)
  if (typeof data.cashReceived === 'number' && data.cashReceived > 0) {
    receipt += padText('Cash Received:', formatCurrency(data.cashReceived), width) + '\n';
    receipt += padText('Change:', formatCurrency(Math.max(0, data.changeGiven ?? (data.cashReceived - data.totalAmount))), width) + '\n';
  }
  
  // Barcode/QR Code section
  if (s.showBarcode || s.showQrCode) {
    receipt += '\n';
    receipt += COMMANDS.ALIGN_CENTER;
    
    if (s.showQrCode || s.barcodeType === 'qrcode') {
      // Print QR Code with receipt number
      receipt += COMMANDS.QRCODE_MODEL;
      receipt += COMMANDS.QRCODE_SIZE(6); // Size 6 for good visibility
      receipt += COMMANDS.QRCODE_ERROR_CORRECTION;
      receipt += COMMANDS.QRCODE_STORE(data.receiptNumber);
      receipt += COMMANDS.QRCODE_PRINT;
      receipt += '\n';
    } else if (s.showBarcode) {
      // Print barcode with receipt number
      receipt += COMMANDS.BARCODE_HEIGHT(50);
      receipt += COMMANDS.BARCODE_WIDTH(2);
      receipt += COMMANDS.BARCODE_TEXT_BELOW;
      
      // Clean receipt number for barcode (alphanumeric only)
      const cleanReceiptNum = data.receiptNumber.replace(/[^A-Z0-9]/gi, '');
      
      if (s.barcodeType === 'code128') {
        receipt += COMMANDS.BARCODE_CODE128(cleanReceiptNum);
      } else {
        receipt += COMMANDS.BARCODE_CODE39(cleanReceiptNum);
      }
      receipt += '\n';
    }
  }
  
  // Footer
  receipt += '\n';
  receipt += COMMANDS.ALIGN_CENTER;
  
  if (s.showFooterMessage && s.footerMessage) {
    receipt += s.footerMessage + '\n';
  }
  
  if (s.showReturnPolicy && s.returnPolicy) {
    receipt += '\n' + s.returnPolicy + '\n';
  }
  
  // Feed and cut
  receipt += COMMANDS.FEED_LINES(4);
  receipt += COMMANDS.CUT_PAPER_PARTIAL;
  
  return receipt;
};

// Convert text to bytes for printer
export const textToBytes = (text: string): Uint8Array => {
  const encoder = new TextEncoder();
  return encoder.encode(text);
};

// Printer connection interfaces - using any for browser APIs that may not have types
export interface BluetoothPrinter {
  device: any; // BluetoothDevice
  characteristic: any; // BluetoothRemoteGATTCharacteristic
}

export interface USBPrinter {
  device: any; // USBDevice
  endpointOut: any; // USBEndpoint
}

export interface EthernetPrinter {
  ipAddress: string;
  port: number;
}

// Check if Web Bluetooth is available
export const isBluetoothSupported = (): boolean => {
  const nav = navigator as any;
  return !!nav.bluetooth;
};

// Check if WebUSB is available
export const isUSBSupported = (): boolean => {
  const nav = navigator as any;
  return !!nav.usb;
};

// Check if we're running in a native app context (Capacitor)
export const isNativeApp = (): boolean => {
  return !!(window as any).Capacitor;
};

// Bluetooth printer connection - with improved device discovery
export const connectBluetoothPrinter = async (): Promise<BluetoothPrinter | null> => {
  try {
    const nav = navigator as any;
    if (!nav.bluetooth) {
      throw new Error('Web Bluetooth is not supported in this browser. Use Chrome on desktop or Android.');
    }
    
    // Request device with broader filters to catch more printers
    // Most thermal printers use the Serial Port Profile (SPP) service
    const device = await nav.bluetooth.requestDevice({
      // Accept all devices to maximize compatibility
      acceptAllDevices: true,
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb', // Common thermal printer service
        '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Nordic UART service
        '0000ff00-0000-1000-8000-00805f9b34fb', // Common SPP UUID
        '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10/HM-16 BLE module
        '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic Semiconductor
      ],
    });
    
    console.log('Bluetooth device selected:', device.name);
    
    const server = await device.gatt?.connect();
    if (!server) throw new Error('Failed to connect to Bluetooth GATT server');
    
    // Try different services until we find one that works
    const serviceUUIDs = [
      '000018f0-0000-1000-8000-00805f9b34fb',
      '49535343-fe7d-4ae5-8fa9-9fafd205e455',
      '0000ff00-0000-1000-8000-00805f9b34fb',
      '0000ffe0-0000-1000-8000-00805f9b34fb',
      '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
    ];
    
    for (const uuid of serviceUUIDs) {
      try {
        const service = await server.getPrimaryService(uuid);
        const characteristics = await service.getCharacteristics();
        
        // Find a writable characteristic
        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            console.log('Found writable characteristic:', char.uuid);
            return { device, characteristic: char };
          }
        }
      } catch (e) {
        // Service not found, try next
        continue;
      }
    }
    
    throw new Error('No writable characteristic found on this Bluetooth device');
  } catch (error) {
    console.error('Bluetooth connection error:', error);
    throw error;
  }
};

// Print via Bluetooth with chunking for reliability
export const printViaBluetooth = async (
  printer: BluetoothPrinter,
  data: Uint8Array
): Promise<boolean> => {
  try {
    // Check if device is still connected
    if (!printer.device.gatt?.connected) {
      await printer.device.gatt?.connect();
    }
    
    // Chunk size - most BLE devices can handle 512 bytes at a time
    // Some older devices may need smaller chunks (20-100 bytes)
    const chunkSize = 200; // Conservative chunk size for maximum compatibility
    
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, Math.min(i + chunkSize, data.length));
      
      // Use writeWithoutResponse if available (faster), otherwise use write
      if (printer.characteristic.properties.writeWithoutResponse) {
        await printer.characteristic.writeValueWithoutResponse(chunk);
      } else {
        await printer.characteristic.writeValue(chunk);
      }
      
      // Small delay between chunks to prevent buffer overflow
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    
    return true;
  } catch (error) {
    console.error('Bluetooth print error:', error);
    throw error;
  }
};

// USB printer connection - with broader vendor ID support
export const connectUSBPrinter = async (): Promise<USBPrinter | null> => {
  try {
    const nav = navigator as any;
    if (!nav.usb) {
      throw new Error('WebUSB is not supported in this browser. Use Chrome on desktop.');
    }
    
    // Request any USB device - let user select their printer
    const device = await nav.usb.requestDevice({
      filters: [
        { vendorId: 0x0416 }, // Winbond (XPrinter)
        { vendorId: 0x04b8 }, // Seiko Epson
        { vendorId: 0x0519 }, // Star Micronics
        { vendorId: 0x1fc9 }, // NXP
        { vendorId: 0x0fe6 }, // ICS
        { vendorId: 0x0483 }, // STMicroelectronics (many cheap printers)
        { vendorId: 0x1a86 }, // QinHeng Electronics (CH340)
        { vendorId: 0x067b }, // Prolific Technology (PL2303)
        { vendorId: 0x10c4 }, // Silicon Labs
        { vendorId: 0x0403 }, // FTDI
        { vendorId: 0x20d1 }, // Simucube (some POS printers)
        { vendorId: 0x0dd4 }, // Custom Engineering (printers)
        { vendorId: 0x0b00 }, // Snbc (printers)
        { vendorId: 0x0485 }, // Nokia (some thermal)
        { vendorId: 0x154f }, // Bixolon
        { vendorId: 0x0d3a }, // Posiflex
        { vendorId: 0x1504 }, // DSP Group
        { vendorId: 0x0dd4 }, // Custom Engineering
      ],
    });
    
    console.log('USB device selected:', device.productName);
    
    await device.open();
    
    // Select configuration 1 (standard)
    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }
    
    // Claim interface 0 (standard printer interface)
    await device.claimInterface(0);
    
    // Find bulk OUT endpoint
    const iface = device.configuration?.interfaces[0];
    const endpoint = iface?.alternate.endpoints.find(
      (e: any) => e.direction === 'out' && e.type === 'bulk'
    );
    
    if (!endpoint) {
      throw new Error('No bulk OUT endpoint found. This device may not be a compatible printer.');
    }
    
    return { device, endpointOut: endpoint };
  } catch (error) {
    console.error('USB connection error:', error);
    throw error;
  }
};

// Print via USB
export const printViaUSB = async (
  printer: USBPrinter,
  data: Uint8Array
): Promise<boolean> => {
  try {
    await printer.device.transferOut(printer.endpointOut.endpointNumber, data);
    return true;
  } catch (error) {
    console.error('USB print error:', error);
    throw error;
  }
};

// Ethernet/Network printing (requires backend proxy for WebSocket or edge function)
export const printViaEthernet = async (
  config: EthernetPrinter,
  data: Uint8Array,
  sendFunction: (ip: string, port: number, data: Uint8Array) => Promise<boolean>
): Promise<boolean> => {
  return await sendFunction(config.ipAddress, config.port, data);
};

// Print test page
export const generateTestPage = (config: PrinterConfig): string => {
  const width = config.charactersPerLine;
  let test = '';
  
  test += COMMANDS.INIT;
  test += COMMANDS.ALIGN_CENTER;
  test += COMMANDS.DOUBLE_SIZE_ON;
  test += 'PRINTER TEST\n';
  test += COMMANDS.NORMAL_SIZE;
  test += divider(width) + '\n';
  test += `Paper Width: ${config.paperWidth}mm\n`;
  test += `Characters/Line: ${width}\n`;
  test += `Brand: ${config.brand}\n`;
  test += divider(width) + '\n\n';
  
  test += COMMANDS.ALIGN_LEFT;
  test += 'Left aligned text\n';
  test += COMMANDS.ALIGN_CENTER;
  test += 'Center aligned text\n';
  test += COMMANDS.ALIGN_RIGHT;
  test += 'Right aligned text\n\n';
  
  test += COMMANDS.ALIGN_LEFT;
  test += COMMANDS.BOLD_ON;
  test += 'Bold text\n';
  test += COMMANDS.BOLD_OFF;
  test += COMMANDS.UNDERLINE_ON;
  test += 'Underlined text\n';
  test += COMMANDS.UNDERLINE_OFF;
  
  test += '\n';
  test += divider(width) + '\n';
  test += COMMANDS.ALIGN_CENTER;
  test += 'Test Complete\n';
  test += new Date().toLocaleString() + '\n';
  
  test += COMMANDS.FEED_LINES(3);
  test += COMMANDS.CUT_PAPER_PARTIAL;
  
  return test;
};

// Browser print fallback - formats receipt for 80mm thermal paper width
export const printViaBrowserFallback = (receiptHtml: string, receiptNumber: string): void => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Could not open print window. Please allow pop-ups.');
  }
  
  printWindow.document.write(`
    <html>
      <head>
        <title>Receipt ${receiptNumber}</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 0;
          }
          body {
            font-family: 'Courier New', 'Consolas', monospace;
            font-size: 11px;
            line-height: 1.3;
            max-width: 80mm;
            margin: 0 auto;
            padding: 5mm;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .receipt-content {
            width: 100%;
          }
        </style>
      </head>
      <body>
        <div class="receipt-content">${receiptHtml}</div>
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() { window.close(); };
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};
