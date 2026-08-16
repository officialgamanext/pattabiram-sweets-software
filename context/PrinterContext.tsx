'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { generateTestReceipt, generateReceiptEscPos, ReceiptData } from '@/lib/escpos';

export type PrinterType = 'USB' | 'Bluetooth' | 'None';
export type PaperWidth = '58mm' | '80mm';

interface PrinterContextType {
  isConnected: boolean;
  printerType: PrinterType;
  printerName: string;
  paperWidth: PaperWidth;
  isPrinting: boolean;
  statusMessage: string;
  lastError: string | null;
  connectUsbPrinter: () => Promise<boolean>;
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
          if (serialPortRef.current.readable) {
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
          await usbDeviceRef.current.close();
        } catch {
          // ignore
        }
        usbDeviceRef.current = null;
      }

      setIsConnected(false);
      setPrinterType('None');
      setPrinterName('');
      setStatusMessage('Disconnected');
    } catch (e: any) {
      console.error('Error disconnecting printer:', e);
    }
  }, []);

  // Connect USB Printer (Web Serial / Web USB)
  const connectUsbPrinter = useCallback(async (): Promise<boolean> => {
    setLastError(null);
    setStatusMessage('Connecting to USB Thermal Printer...');

    try {
      // Check if Web Serial is supported (Preferred for ESC/POS USB thermal printers)
      if (typeof navigator !== 'undefined' && 'serial' in navigator) {
        const serial = (navigator as any).serial;
        const port = await serial.requestPort();
        await port.open({ baudRate: 9600 });
        
        serialPortRef.current = port;
        setIsConnected(true);
        setPrinterType('USB');
        
        // Attempt to extract device info if available
        const info = port.getInfo ? port.getInfo() : {};
        const devTitle = info.usbVendorId
          ? `USB Thermal Printer (VID:${info.usbVendorId.toString(16).toUpperCase()})`
          : 'USB Thermal Receipt Printer';

        setPrinterName(devTitle);
        setStatusMessage(`Connected to ${devTitle}`);
        return true;
      }

      // Secondary Web USB Fallback
      if (typeof navigator !== 'undefined' && 'usb' in navigator) {
        const usb = (navigator as any).usb;
        const device = await usb.requestDevice({
          filters: [{ classCode: 7 }], // USB Printer Class
        });

        await device.open();
        if (device.configuration === null) {
          await device.selectConfiguration(1);
        }
        await device.claimInterface(0);

        usbDeviceRef.current = device;
        setIsConnected(true);
        setPrinterType('USB');
        const devName = device.productName || 'WebUSB Thermal Printer';
        setPrinterName(devName);
        setStatusMessage(`Connected to ${devName}`);
        return true;
      }

      // If browser doesn't support WebUSB/Serial API
      const errMsg = 'Web USB / Web Serial API is not supported in this browser. Use Google Chrome or Microsoft Edge for direct hardware printing.';
      setLastError(errMsg);
      setStatusMessage(errMsg);
      alert(errMsg);
      return false;
    } catch (err: any) {
      if (err.name === 'NotFoundError' || err.message?.includes('No port selected') || err.message?.includes('cancelled')) {
        setStatusMessage('USB selection cancelled.');
        return false;
      }
      console.error('USB Printer connection error:', err);
      const msg = err.message || 'Failed to connect USB thermal printer.';
      setLastError(msg);
      setStatusMessage(`USB error: ${msg}`);
      return false;
    }
  }, []);

  // Connect Bluetooth Printer (Web Bluetooth API)
  const connectBluetoothPrinter = useCallback(async (): Promise<boolean> => {
    setLastError(null);
    setStatusMessage('Searching for Bluetooth Thermal Printers...');

    try {
      if (typeof navigator === 'undefined' || !(navigator as any).bluetooth) {
        const errMsg = 'Web Bluetooth API is not supported in this browser. Please use Google Chrome or Microsoft Edge with Bluetooth enabled.';
        setLastError(errMsg);
        setStatusMessage(errMsg);
        alert(errMsg);
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

      bleDeviceRef.current = device;
      bleCharacteristicRef.current = writeChar;

      setIsConnected(true);
      setPrinterType('Bluetooth');
      const devName = device.name || 'Bluetooth Thermal Printer';
      setPrinterName(devName);
      setStatusMessage(`Connected to ${devName}`);
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
  }, []);

  // Stream raw bytes / ESC/POS commands to active hardware device
  const printRaw = useCallback(async (data: Uint8Array | string): Promise<boolean> => {
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
        const writer = port.writable.getWriter();
        await writer.write(bytes);
        writer.releaseLock();
        setStatusMessage('Print completed successfully');
        setIsPrinting(false);
        return true;
      }

      // 2. Web USB Direct Transfer
      if (printerType === 'USB' && usbDeviceRef.current) {
        const device = usbDeviceRef.current;
        // Transfer Out to endpoint 1 or first OUT endpoint
        await device.transferOut(1, bytes);
        setStatusMessage('Print completed via WebUSB');
        setIsPrinting(false);
        return true;
      }

      // 3. Bluetooth BLE Stream in chunks (max 512 bytes / chunk)
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
        setIsPrinting(false);
        return true;
      }

      // Fallback: If no hardware printer is connected, trigger browser print
      setStatusMessage('No direct thermal printer connected. Opening system print...');
      window.print();
      setIsPrinting(false);
      return true;
    } catch (err: any) {
      console.error('Print execution error:', err);
      const msg = err.message || 'Print job failed.';
      setLastError(msg);
      setStatusMessage(`Print failed: ${msg}`);
      setIsPrinting(false);
      return false;
    }
  }, [printerType]);

  // Quick Test Slip Print
  const printTestSlip = useCallback(async (): Promise<boolean> => {
    const rawBytes = generateTestReceipt(paperWidth);
    return await printRaw(rawBytes);
  }, [paperWidth, printRaw]);

  // Formatted Receipt Print
  const printReceipt = useCallback(
    async (data: ReceiptData): Promise<boolean> => {
      const rawBytes = generateReceiptEscPos(data, paperWidth);
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
        printerName,
        paperWidth,
        isPrinting,
        statusMessage,
        lastError,
        connectUsbPrinter,
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
