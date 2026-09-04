'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { generateTestReceipt, generateReceiptEscPos, ReceiptData } from '@/lib/escpos';
import { getBusinessSettingsSync, formatStoreAddress, formatStorePhone } from '@/lib/businessSettings';
import { toast } from '@/context/ToastContext';

export type PrinterType = 'USB' | 'Bluetooth' | 'None';
export type UsbSubtype = 'WebUSB' | 'Serial' | 'None';
export type PaperWidth = '58mm' | '80mm';

interface PrinterContextType {
  isConnected: boolean;
  printerType: PrinterType;
  usbSubtype: UsbSubtype;
  printerName: string;
  paperWidth: PaperWidth;
  isPrinting: boolean;
  statusMessage: string;
  lastError: string | null;
  connectUsbPrinter: () => Promise<boolean>;
  connectWebUsbPrinter: () => Promise<boolean>;
  connectUsbSerialPrinter: () => Promise<boolean>;
  connectBluetoothPrinter: () => Promise<boolean>;
  disconnectPrinter: () => Promise<void>;
  printRaw: (data: Uint8Array | string) => Promise<boolean>;
  printTestSlip: () => Promise<boolean>;
  printReceipt: (data: ReceiptData) => Promise<boolean>;
  printWindow: () => void;
  setPaperWidth: (width: PaperWidth) => void;
  clearError: () => void;
}

const PrinterContext = createContext<PrinterContextType | undefined>(undefined);

// Known thermal printer BLE service UUIDs
const BLE_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ae00-0000-1000-8000-00805f9b34fb',
  '00001800-0000-1000-8000-00805f9b34fb',
  '00001801-0000-1000-8000-00805f9b34fb',
];

export const PrinterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [printerType, setPrinterType] = useState<PrinterType>('None');
  const [usbSubtype, setUsbSubtype] = useState<UsbSubtype>('None');
  const [printerName, setPrinterName] = useState<string>('');
  const [paperWidth, setPaperWidthState] = useState<PaperWidth>('58mm');
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Ready');
  const [lastError, setLastError] = useState<string | null>(null);

  // Active hardware handles kept in refs to avoid re-rendering
  const serialPortRef = useRef<any>(null);
  const bleDeviceRef = useRef<any>(null);
  const bleCharacteristicRef = useRef<any>(null);
  const usbDeviceRef = useRef<any>(null);
  const usbInterfaceRef = useRef<number | null>(null);
  const usbEndpointRef = useRef<number | null>(null);
  const printQueueRef = useRef<Promise<boolean>>(Promise.resolve(true));

  // Load saved preferences on mount
  useEffect(() => {
    try {
      const savedWidth = localStorage.getItem('pattabiram_printer_width') as PaperWidth;
      if (savedWidth === '58mm' || savedWidth === '80mm') {
        setPaperWidthState(savedWidth);
      }
    } catch {
      // ignore
    }
  }, []);

  const setPaperWidth = (width: PaperWidth) => {
    setPaperWidthState(width);
    try {
      localStorage.setItem('pattabiram_printer_width', width);
    } catch {
      // ignore
    }
  };

  const clearError = () => setLastError(null);

  // Disconnect active printer
  const disconnectPrinter = useCallback(async () => {
    try {
      if (serialPortRef.current) {
        try {
          await printQueueRef.current.catch(() => {});
          if (serialPortRef.current.writable && !serialPortRef.current.writable.locked) {
            await serialPortRef.current.close();
          }
        } catch {
          // ignore
        }
        serialPortRef.current = null;
      }

      if (bleDeviceRef.current && bleDeviceRef.current.gatt && bleDeviceRef.current.gatt.connected) {
        try {
          bleDeviceRef.current.gatt.disconnect();
        } catch {
          // ignore
        }
        bleDeviceRef.current = null;
        bleCharacteristicRef.current = null;
      }

      if (usbDeviceRef.current) {
        try {
          if (usbInterfaceRef.current !== null) {
            try {
              await usbDeviceRef.current.releaseInterface(usbInterfaceRef.current);
            } catch {
              // ignore
            }
          }
          await usbDeviceRef.current.close();
        } catch {
          // ignore
        }
        usbDeviceRef.current = null;
        usbInterfaceRef.current = null;
        usbEndpointRef.current = null;
      }

      setIsConnected(false);
      setPrinterType('None');
      setUsbSubtype('None');
      setPrinterName('');
      setStatusMessage('Disconnected');
    } catch (e: any) {
      console.error('Error disconnecting printer:', e);
    }
  }, []);

  // 1. Primary USB Connection: Web USB Direct
  const connectWebUsbPrinter = useCallback(async (): Promise<boolean> => {
    setLastError(null);
    setStatusMessage('Connecting to Web USB Printer...');

    try {
      if (typeof navigator === 'undefined' || !('usb' in navigator)) {
        const msg = 'Web USB is not supported in this browser. Use Google Chrome or Microsoft Edge.';
        setLastError(msg);
        setStatusMessage(msg);
        toast.warning('Browser Not Supported', msg);
        return false;
      }

      const usb = (navigator as any).usb;
      const device = await usb.requestDevice({
        filters: [
          { classCode: 7 },   // Standard USB Printer Class
          { classCode: 255 }, // Vendor Specific POS chip Class
          { classCode: 0 },   // Composite USB device Class
        ],
      });

      await device.open();
      if (!device.configuration) {
        await device.selectConfiguration(1);
      }

      // Discover bulk OUT endpoint dynamically
      let targetInterfaceNumber: number | null = null;
      let targetEndpointNumber: number | null = null;

      if (device.configuration && device.configuration.interfaces) {
        for (const iface of device.configuration.interfaces) {
          for (const alt of iface.alternates) {
            const outEp = alt.endpoints.find((ep: any) => ep.direction === 'out');
            if (outEp) {
              targetInterfaceNumber = iface.interfaceNumber;
              targetEndpointNumber = outEp.endpointNumber;
              break;
            }
          }
          if (targetEndpointNumber !== null) break;
        }
      }

      const ifaceToClaim = targetInterfaceNumber !== null ? targetInterfaceNumber : 0;
      const epToUse = targetEndpointNumber !== null ? targetEndpointNumber : 1;

      try {
        await device.claimInterface(ifaceToClaim);
      } catch (claimErr: any) {
        console.warn('Interface claim notice:', claimErr);
      }

      // Clean existing handles
      await disconnectPrinter();

      usbDeviceRef.current = device;
      usbInterfaceRef.current = ifaceToClaim;
      usbEndpointRef.current = epToUse;

      setIsConnected(true);
      setPrinterType('USB');
      setUsbSubtype('WebUSB');

      const devName = device.productName || device.manufacturerName || 'USB Thermal Receipt Printer';
      setPrinterName(devName);
      setStatusMessage(`Connected via WebUSB: ${devName}`);
      toast.success('Printer Connected', `Connected to ${devName}`);
      return true;
    } catch (err: any) {
      if (err.name === 'NotFoundError' || err.message?.includes('No device selected') || err.message?.includes('cancelled')) {
        setStatusMessage('USB pairing cancelled.');
        return false;
      }
      console.error('WebUSB pairing error:', err);
      let msg = err.message || 'Failed to connect via WebUSB.';
      if (msg.includes('Access denied') || msg.includes('SecurityError')) {
        msg = 'Access denied. The Windows printer driver may be claiming this USB device. You can use Browser Print directly.';
      }
      setLastError(msg);
      setStatusMessage(`USB error: ${msg}`);
      toast.error('USB Pairing Failed', msg);
      return false;
    }
  }, [disconnectPrinter]);

  // 2. Secondary USB Connection: Web Serial (COM port)
  const connectUsbSerialPrinter = useCallback(async (): Promise<boolean> => {
    setLastError(null);
    setStatusMessage('Selecting USB Serial / COM Port...');

    try {
      if (typeof navigator === 'undefined' || !('serial' in navigator)) {
        const msg = 'Web Serial API is not supported in this browser. Please use Chrome or Edge.';
        setLastError(msg);
        setStatusMessage(msg);
        toast.warning('Browser Not Supported', msg);
        return false;
      }

      const serial = (navigator as any).serial;
      const port = await serial.requestPort();
      await port.open({ baudRate: 9600 });

      // Clean existing
      await disconnectPrinter();

      serialPortRef.current = port;
      setIsConnected(true);
      setPrinterType('USB');
      setUsbSubtype('Serial');

      const info = port.getInfo ? port.getInfo() : {};
      const devTitle = info.usbVendorId
        ? `USB Serial Printer (VID:${info.usbVendorId.toString(16).toUpperCase()})`
        : 'USB Serial Thermal Printer';

      setPrinterName(devTitle);
      setStatusMessage(`Connected via Serial: ${devTitle}`);
      toast.success('Serial Printer Connected', `Connected to ${devTitle}`);
      return true;
    } catch (err: any) {
      if (err.name === 'NotFoundError' || err.message?.includes('No port selected') || err.message?.includes('cancelled')) {
        setStatusMessage('Serial port selection cancelled.');
        return false;
      }
      console.error('Serial port error:', err);
      const msg = err.message || 'Failed to open serial port. The port may be locked by Windows or in use.';
      setLastError(msg);
      setStatusMessage(`Serial error: ${msg}`);
      toast.error('Serial Open Failed', msg);
      return false;
    }
  }, [disconnectPrinter]);

  // Default USB button action: tries WebUSB first (standard for direct USB thermal printers)
  const connectUsbPrinter = useCallback(async (): Promise<boolean> => {
    if (typeof navigator !== 'undefined' && 'usb' in navigator) {
      return await connectWebUsbPrinter();
    }
    if (typeof navigator !== 'undefined' && 'serial' in navigator) {
      return await connectUsbSerialPrinter();
    }
    return false;
  }, [connectWebUsbPrinter, connectUsbSerialPrinter]);

  // Connect Bluetooth Printer (Web Bluetooth API)
  const connectBluetoothPrinter = useCallback(async (): Promise<boolean> => {
    setLastError(null);
    setStatusMessage('Searching for Bluetooth Thermal Printers...');

    try {
      if (typeof navigator === 'undefined' || !(navigator as any).bluetooth) {
        const errMsg = 'Web Bluetooth API is not supported in this browser. Please use Chrome or Edge with Bluetooth enabled.';
        setLastError(errMsg);
        setStatusMessage(errMsg);
        toast.warning('Bluetooth Not Supported', errMsg);
        return false;
      }

      const bluetooth = (navigator as any).bluetooth;
      const device = await bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: BLE_SERVICES,
      });

      setStatusMessage(`Pairing with ${device.name || 'Bluetooth Device'}...`);
      
      const server = await device.gatt.connect();

      // Listen for disconnect
      device.addEventListener('gattserverdisconnected', () => {
        setIsConnected(false);
        setPrinterType('None');
        setUsbSubtype('None');
        setPrinterName('');
        setStatusMessage('Bluetooth printer disconnected');
      });

      // Discover services and find writable characteristic
      let writeChar: any = null;
      const services = await server.getPrimaryServices();

      for (const service of services) {
        try {
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              writeChar = char;
              break;
            }
          }
          if (writeChar) break;
        } catch {
          // continue checking other services
        }
      }

      // Clean existing
      await disconnectPrinter();

      bleDeviceRef.current = device;
      bleCharacteristicRef.current = writeChar;

      setIsConnected(true);
      setPrinterType('Bluetooth');
      setUsbSubtype('None');
      const devName = device.name || 'Bluetooth Thermal Printer';
      setPrinterName(devName);
      setStatusMessage(`Connected to ${devName}`);
      toast.success('Bluetooth Connected', `Connected to ${devName}`);
      return true;
    } catch (err: any) {
      if (err.name === 'NotFoundError' || err.message?.includes('User cancelled')) {
        setStatusMessage('Bluetooth pairing cancelled.');
        return false;
      }
      console.error('Bluetooth connection error:', err);
      const msg = err.message || 'Failed to connect to Bluetooth printer.';
      setLastError(msg);
      setStatusMessage(`Bluetooth error: ${msg}`);
      return false;
    }
  }, [disconnectPrinter]);

  // Stream raw bytes / ESC/POS commands to active hardware device
  const printRaw = useCallback((data: Uint8Array | string): Promise<boolean> => {
    const executePrint = async (): Promise<boolean> => {
      setIsPrinting(true);
      setStatusMessage('Sending print job...');
      setLastError(null);

      const bytes: Uint8Array =
        typeof data === 'string' ? new TextEncoder().encode(data) : data;

      try {
        // 1. USB Serial Port Stream
        if (printerType === 'USB' && serialPortRef.current) {
          const port = serialPortRef.current;
          if (!port.writable) {
            throw new Error('USB Serial port is not writable or was disconnected.');
          }

          // If locked, wait briefly for preceding task to release
          let attempts = 0;
          while (port.writable.locked && attempts < 10) {
            await new Promise((res) => setTimeout(res, 50));
            attempts++;
          }

          if (port.writable.locked) {
            throw new Error('USB Serial stream is busy. Please try again.');
          }

          const writer = port.writable.getWriter();
          try {
            await writer.write(bytes);
          } finally {
            try {
              writer.releaseLock();
            } catch (lockErr) {
              console.warn('Failed to release writer lock:', lockErr);
            }
          }

          setStatusMessage('Print completed successfully via Serial');
          return true;
        }

        // 2. Web USB Direct Transfer
        if (printerType === 'USB' && usbDeviceRef.current) {
          const device = usbDeviceRef.current;
          const ep = usbEndpointRef.current || 1;

          // Verify connection is open and interface claimed
          if (!device.opened) {
            await device.open();
            if (!device.configuration) {
              await device.selectConfiguration(1);
            }
            if (usbInterfaceRef.current !== null) {
              await device.claimInterface(usbInterfaceRef.current);
            }
          }

          // Clear any lingering endpoint halt / stall from previous print jobs
          try {
            await device.clearHalt('out', ep);
          } catch {
            // ignore if not halted
          }

          // Stream bytes in chunks (64 bytes per packet for USB Full-Speed printer buffer safety)
          const chunkSize = 64;
          for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.slice(i, i + chunkSize);
            let chunkSent = false;
            let lastErr: any = null;

            for (let attempt = 0; attempt < 3; attempt++) {
              try {
                const res = await device.transferOut(ep, chunk);
                if (res.status === 'ok') {
                  chunkSent = true;
                  break;
                }
              } catch (e: any) {
                lastErr = e;
                // Attempt to clear endpoint halt
                try {
                  await device.clearHalt('out', ep);
                } catch {
                  // ignore
                }
                await new Promise((r) => setTimeout(r, 20));
              }
            }

            if (!chunkSent) {
              console.error('WebUSB chunk failure at offset', i, lastErr);
              throw lastErr || new Error(`USB transfer stalled at byte ${i}`);
            }

            // Pacing delay (5ms) to give the printer's microcontroller FIFO buffer time to drain
            if (i + chunkSize < bytes.length) {
              await new Promise((r) => setTimeout(r, 5));
            }
          }

          setStatusMessage('Print completed via WebUSB');
          return true;
        }

        // 3. Bluetooth BLE Stream in chunks (max 128 bytes / chunk)
        if (printerType === 'Bluetooth' && bleCharacteristicRef.current) {
          const char = bleCharacteristicRef.current;
          const chunkSize = 128; // safe BLE packet size for ESC/POS
          for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.slice(i, i + chunkSize);
            if (char.writeValueWithoutResponse) {
              await char.writeValueWithoutResponse(chunk);
            } else {
              await char.writeValue(chunk);
            }
            // Micro delay to avoid BLE buffer saturation
            await new Promise((res) => setTimeout(res, 25));
          }
          setStatusMessage('Print completed via Bluetooth');
          return true;
        }

        // Fallback: If no hardware printer is connected, trigger browser print
        setStatusMessage('No direct thermal printer connected. Opening system print...');
        window.print();
        return true;
      } catch (err: any) {
        console.error('Print execution error:', err);
        const msg = err.message || 'Print job failed.';
        setLastError(msg);
        setStatusMessage(`Print failed: ${msg}`);
        return false;
      } finally {
        setIsPrinting(false);
      }
    };

    // Serialize print operations through queue
    const nextTask = printQueueRef.current
      .catch(() => false)
      .then(() => executePrint());

    printQueueRef.current = nextTask;
    return nextTask;
  }, [printerType]);

  // Quick Test Slip Print
  const printTestSlip = useCallback(async (): Promise<boolean> => {
    const rawBytes = generateTestReceipt(paperWidth);
    return await printRaw(rawBytes);
  }, [paperWidth, printRaw]);

  // Formatted Receipt Print (Auto-enriches with live business settings from Settings page)
  const printReceipt = useCallback(
    async (data: ReceiptData): Promise<boolean> => {
      const s = getBusinessSettingsSync();
      const enrichedData: ReceiptData = {
        ...data,
        storeName: (data.storeName && data.storeName !== 'PATTABIRAM SWEETS') ? data.storeName : (s.businessName || 'PATTABIRAM SWEETS'),
        storeTagline: data.storeTagline || s.tagline,
        storeAddress: (data.storeAddress && !data.storeAddress.includes('12, Main Road, Pattabiram')) ? data.storeAddress : formatStoreAddress(s),
        storePhone: (data.storePhone && !data.storePhone.includes('98765 43210')) ? data.storePhone : formatStorePhone(s),
        storeEmail: data.storeEmail || s.email,
        storeGst: data.storeGst || s.gstNumber,
        storeFssai: data.storeFssai || s.fssaiNumber,
        storeWebsite: data.storeWebsite || s.website,
        footerNote: (data.footerNote && !data.footerNote.includes('Order verified')) ? data.footerNote : (s.footerNote || data.footerNote || 'Thank you for choosing Pattabiram Sweets! Visit again!'),
      };

      const rawBytes = generateReceiptEscPos(enrichedData, paperWidth);
      return await printRaw(rawBytes);
    },
    [paperWidth, printRaw]
  );

  // Standard window.print fallback
  const printWindow = useCallback(() => {
    window.print();
  }, []);

  return (
    <PrinterContext.Provider
      value={{
        isConnected,
        printerType,
        usbSubtype,
        printerName,
        paperWidth,
        isPrinting,
        statusMessage,
        lastError,
        connectUsbPrinter,
        connectWebUsbPrinter,
        connectUsbSerialPrinter,
        connectBluetoothPrinter,
        disconnectPrinter,
        printRaw,
        printTestSlip,
        printReceipt,
        printWindow,
        setPaperWidth,
        clearError,
      }}
    >
      {children}
    </PrinterContext.Provider>
  );
};

export const usePrinter = (): PrinterContextType => {
  const context = useContext(PrinterContext);
  if (!context) {
    throw new Error('usePrinter must be used within a PrinterProvider');
  }
  return context;
};
