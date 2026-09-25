'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Calculator as CalcIcon,
  X,
  Minimize2,
  Maximize2,
  Copy,
  Check,
  History,
  Trash2,
  Percent,
  Plus,
  Minus,
  Divide,
  X as Multiply,
  Equal,
  Delete,
} from 'lucide-react';

interface CalculationHistoryItem {
  id: string;
  expression: string;
  result: string;
  timestamp: string;
}

interface CalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CalculatorModal({ isOpen, onClose }: CalculatorModalProps) {
  const [display, setDisplay] = useState<string>('0');
  const [equation, setEquation] = useState<string>('');
  const [prevNumber, setPrevNumber] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForNewNumber, setWaitingForNewNumber] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [history, setHistory] = useState<CalculationHistoryItem[]>([]);

  // Load history from localStorage once on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pattabiram_calc_history');
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch {}
  }, []);

  const saveHistory = useCallback((items: CalculationHistoryItem[]) => {
    setHistory(items);
    try {
      localStorage.setItem('pattabiram_calc_history', JSON.stringify(items.slice(0, 30)));
    } catch {}
  }, []);

  // Format number nicely
  const formatDisplay = (val: string) => {
    if (!val || val === 'Error') return val;
    if (val.endsWith('.')) return val;
    const parts = val.split('.');
    const integerPart = parseFloat(parts[0]).toLocaleString('en-IN');
    if (parts.length > 1) {
      return `${isNaN(parseFloat(parts[0])) ? parts[0] : integerPart}.${parts[1]}`;
    }
    return isNaN(parseFloat(val)) ? val : integerPart;
  };

  // Input Digit
  const handleDigit = useCallback(
    (digit: string) => {
      if (waitingForNewNumber) {
        setDisplay(digit);
        setWaitingForNewNumber(false);
      } else {
        if (display === '0') {
          setDisplay(digit);
        } else if (display.length < 14) {
          setDisplay(display + digit);
        }
      }
    },
    [display, waitingForNewNumber]
  );

  // Decimal
  const handleDecimal = useCallback(() => {
    if (waitingForNewNumber) {
      setDisplay('0.');
      setWaitingForNewNumber(false);
    } else if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  }, [display, waitingForNewNumber]);

  // Clear current entry
  const handleClearEntry = useCallback(() => {
    setDisplay('0');
  }, []);

  // Clear All
  const handleClearAll = useCallback(() => {
    setDisplay('0');
    setEquation('');
    setPrevNumber(null);
    setOperation(null);
    setWaitingForNewNumber(false);
  }, []);

  // Backspace
  const handleBackspace = useCallback(() => {
    if (waitingForNewNumber) return;
    if (display.length <= 1 || (display.length === 2 && display.startsWith('-'))) {
      setDisplay('0');
    } else {
      setDisplay(display.slice(0, -1));
    }
  }, [display, waitingForNewNumber]);

  // Toggle +/-
  const handleToggleSign = useCallback(() => {
    if (display === '0' || display === 'Error') return;
    if (display.startsWith('-')) {
      setDisplay(display.slice(1));
    } else {
      setDisplay('-' + display);
    }
  }, [display]);

  // Calculate result of op
  const executeOperation = (op: string, a: number, b: number): number => {
    switch (op) {
      case '+':
        return a + b;
      case '-':
        return a - b;
      case '×':
      case '*':
        return a * b;
      case '÷':
      case '/':
        return b === 0 ? NaN : a / b;
      default:
        return b;
    }
  };

  // Operation button pressed (+, -, ×, ÷)
  const handleOperation = useCallback(
    (op: string) => {
      const current = parseFloat(display);

      if (prevNumber === null) {
        setPrevNumber(current);
        setOperation(op);
        setEquation(`${display} ${op}`);
        setWaitingForNewNumber(true);
      } else if (operation) {
        if (waitingForNewNumber) {
          // Changed mind on operator
          setOperation(op);
          setEquation(`${prevNumber} ${op}`);
        } else {
          const res = executeOperation(operation, prevNumber, current);
          if (isNaN(res) || !isFinite(res)) {
            setDisplay('Error');
            setPrevNumber(null);
            setOperation(null);
            setEquation('');
          } else {
            const cleanRes = Math.round(res * 10000) / 10000;
            setDisplay(String(cleanRes));
            setPrevNumber(cleanRes);
            setOperation(op);
            setEquation(`${cleanRes} ${op}`);
            setWaitingForNewNumber(true);
          }
        }
      }
    },
    [display, prevNumber, operation, waitingForNewNumber]
  );

  // Equals
  const handleEquals = useCallback(() => {
    if (prevNumber === null || operation === null) return;

    const current = parseFloat(display);
    const res = executeOperation(operation, prevNumber, current);

    if (isNaN(res) || !isFinite(res)) {
      setDisplay('Error');
      setEquation('');
      setPrevNumber(null);
      setOperation(null);
      setWaitingForNewNumber(false);
    } else {
      const cleanRes = Math.round(res * 10000) / 10000;
      const fullExpr = `${prevNumber} ${operation} ${current} =`;
      setEquation(fullExpr);
      setDisplay(String(cleanRes));

      // Append to history
      const newEntry: CalculationHistoryItem = {
        id: Date.now().toString(),
        expression: fullExpr,
        result: String(cleanRes),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      saveHistory([newEntry, ...history.slice(0, 29)]);

      setPrevNumber(null);
      setOperation(null);
      setWaitingForNewNumber(true);
    }
  }, [display, prevNumber, operation, history, saveHistory]);

  // Quick GST Percentage Calculation
  const handleGstAdd = useCallback(
    (rate: number) => {
      const current = parseFloat(display);
      if (isNaN(current) || current <= 0) return;
      const gstAmount = Math.round(((current * rate) / 100) * 100) / 100;
      const total = Math.round((current + gstAmount) * 100) / 100;
      const expr = `${current} + ${rate}% GST =`;
      setEquation(expr);
      setDisplay(String(total));

      const newEntry: CalculationHistoryItem = {
        id: Date.now().toString(),
        expression: expr,
        result: String(total),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      saveHistory([newEntry, ...history.slice(0, 29)]);
      setPrevNumber(null);
      setOperation(null);
      setWaitingForNewNumber(true);
    },
    [display, history, saveHistory]
  );

  // Reverse GST (Find Base Price from Inclusive Price)
  const handleGstRemove = useCallback(
    (rate: number) => {
      const current = parseFloat(display);
      if (isNaN(current) || current <= 0) return;
      const base = Math.round(((current * 100) / (100 + rate)) * 100) / 100;
      const expr = `${current} - ${rate}% Base =`;
      setEquation(expr);
      setDisplay(String(base));

      const newEntry: CalculationHistoryItem = {
        id: Date.now().toString(),
        expression: expr,
        result: String(base),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      saveHistory([newEntry, ...history.slice(0, 29)]);
      setPrevNumber(null);
      setOperation(null);
      setWaitingForNewNumber(true);
    },
    [display, history, saveHistory]
  );

  // Copy result to clipboard
  const handleCopy = () => {
    if (!navigator?.clipboard) return;
    navigator.clipboard.writeText(display);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Keyboard shortcut listener
  useEffect(() => {
    if (!isOpen || isMinimized) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === '.') {
        e.preventDefault();
        handleDecimal();
      } else if (e.key === '+') {
        e.preventDefault();
        handleOperation('+');
      } else if (e.key === '-') {
        e.preventDefault();
        handleOperation('-');
      } else if (e.key === '*' || e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        handleOperation('×');
      } else if (e.key === '/') {
        e.preventDefault();
        handleOperation('÷');
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        handleEquals();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleClearAll();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    isMinimized,
    handleDigit,
    handleDecimal,
    handleOperation,
    handleEquals,
    handleBackspace,
    handleClearAll,
    onClose,
  ]);

  if (!isOpen) return null;

  // Minimized Floating Pill
  if (isMinimized) {
    return (
      <div className="fixed bottom-5 right-5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
        <div className="flex items-center gap-2 bg-[#02626D] text-white px-3.5 py-2 rounded-2xl shadow-2xl border border-teal-500/30">
          <CalcIcon size={16} className="text-teal-200" />
          <span className="font-bold text-xs">Calc: {formatDisplay(display)}</span>
          <button
            onClick={() => setIsMinimized(false)}
            className="p-1 hover:bg-[#024f58] rounded-lg transition-colors cursor-pointer text-teal-100"
            title="Expand Calculator"
          >
            <Maximize2 size={13} />
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#024f58] rounded-lg transition-colors cursor-pointer text-teal-100"
            title="Close"
          >
            <X size={13} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[340px] max-w-[calc(100vw-32px)] bg-slate-900 text-white rounded-3xl shadow-2xl border border-slate-700/80 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150 font-sans select-none">
      {/* ── 1. Top Header Bar ────────────────────────────────────────── */}
      <div className="bg-[#024d56] px-4 py-3 flex items-center justify-between border-b border-teal-800/40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center border border-teal-400/30">
            <CalcIcon size={15} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white tracking-wide">Quick Calculator</h3>
            <p className="text-[10px] text-teal-200 font-medium">Counter Billing &amp; Tax</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              showHistory
                ? 'bg-teal-500 text-slate-950 font-bold'
                : 'text-teal-200 hover:text-white hover:bg-[#024047]'
            }`}
            title="Toggle Tape History"
          >
            <History size={14} />
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 text-teal-200 hover:text-white hover:bg-[#024047] rounded-lg transition-colors cursor-pointer"
            title="Minimize"
          >
            <Minimize2 size={14} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-teal-200 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
            title="Close"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* ── 2. History Tape Panel (Collapsible) ────────────────────────── */}
      {showHistory && (
        <div className="bg-slate-950/95 border-b border-slate-800 p-3 max-h-48 overflow-y-auto space-y-2">
          <div className="flex items-center justify-between pb-1 border-b border-slate-800 text-[11px] font-bold text-slate-400">
            <span>Calculation History</span>
            {history.length > 0 && (
              <button
                onClick={() => saveHistory([])}
                className="text-rose-400 hover:text-rose-300 text-[10px] flex items-center gap-1 cursor-pointer"
              >
                <Trash2 size={11} /> Clear
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <p className="text-[11px] text-slate-500 py-3 text-center italic">No calculation history yet</p>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  setDisplay(item.result);
                  setWaitingForNewNumber(true);
                }}
                className="p-1.5 rounded-lg hover:bg-slate-800/80 cursor-pointer text-right group transition-all"
              >
                <div className="text-[10px] text-slate-400 font-mono">{item.expression}</div>
                <div className="text-sm font-bold text-teal-300 font-mono group-hover:text-amber-300">
                  = {item.result}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── 3. Screen / Display Section ─────────────────────────────── */}
      <div className="p-4 bg-slate-950/80 text-right border-b border-slate-800/80">
        <div className="h-5 text-xs text-slate-400 font-mono overflow-hidden text-ellipsis whitespace-nowrap">
          {equation || '\u00A0'}
        </div>
        <div className="flex items-baseline justify-between gap-2 mt-1">
          <button
            onClick={handleCopy}
            className="text-[10px] font-semibold text-slate-400 hover:text-teal-300 flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 cursor-pointer transition-colors"
            title="Copy Result"
          >
            {copied ? (
              <>
                <Check size={11} className="text-emerald-400" />
                <span className="text-emerald-400 font-bold">Copied!</span>
              </>
            ) : (
              <>
                <Copy size={11} />
                <span>Copy</span>
              </>
            )}
          </button>
          <div className="text-3xl font-extrabold font-mono tracking-tight text-white overflow-hidden text-ellipsis whitespace-nowrap max-w-[240px]">
            {formatDisplay(display)}
          </div>
        </div>
      </div>

      {/* ── 4. Quick Tax / Retail Preset Strip ───────────────────────── */}
      <div className="grid grid-cols-4 gap-1 p-2 bg-slate-900 border-b border-slate-800 text-[10.5px] font-bold">
        <button
          onClick={() => handleGstAdd(5)}
          className="py-1 px-1 rounded-lg bg-teal-950/70 hover:bg-teal-900 text-teal-300 border border-teal-800/50 cursor-pointer transition-colors"
          title="Add 5% GST to current amount"
        >
          +5% GST
        </button>
        <button
          onClick={() => handleGstAdd(12)}
          className="py-1 px-1 rounded-lg bg-teal-950/70 hover:bg-teal-900 text-teal-300 border border-teal-800/50 cursor-pointer transition-colors"
          title="Add 12% GST to current amount"
        >
          +12% GST
        </button>
        <button
          onClick={() => handleGstAdd(18)}
          className="py-1 px-1 rounded-lg bg-teal-950/70 hover:bg-teal-900 text-teal-300 border border-teal-800/50 cursor-pointer transition-colors"
          title="Add 18% GST to current amount"
        >
          +18% GST
        </button>
        <button
          onClick={() => handleGstRemove(5)}
          className="py-1 px-1 rounded-lg bg-amber-950/60 hover:bg-amber-900 text-amber-300 border border-amber-800/50 cursor-pointer transition-colors"
          title="Extract 5% Base Price from Inclusive Amount"
        >
          -5% Base
        </button>
      </div>

      {/* ── 5. Main Keypad ─────────────────────────────────────────── */}
      <div className="p-3 bg-slate-900 grid grid-cols-4 gap-2">
        {/* Row 1: Clear and Controls */}
        <button
          onClick={handleClearAll}
          className="h-11 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 font-bold text-sm border border-rose-900/50 cursor-pointer active:scale-95 transition-all"
        >
          AC
        </button>
        <button
          onClick={handleClearEntry}
          className="h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm border border-slate-700/60 cursor-pointer active:scale-95 transition-all"
        >
          C
        </button>
        <button
          onClick={handleBackspace}
          className="h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center border border-slate-700/60 cursor-pointer active:scale-95 transition-all"
          title="Backspace"
        >
          <Delete size={17} />
        </button>
        <button
          onClick={() => handleOperation('÷')}
          className={`h-11 rounded-xl font-extrabold text-base flex items-center justify-center border cursor-pointer active:scale-95 transition-all ${
            operation === '÷'
              ? 'bg-amber-500 text-slate-950 border-amber-400'
              : 'bg-[#02626D] hover:bg-[#037886] text-white border-teal-600/60'
          }`}
        >
          <Divide size={18} />
        </button>

        {/* Row 2: 7, 8, 9, × */}
        <button
          onClick={() => handleDigit('7')}
          className="h-11 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-white font-bold text-base border border-slate-700/40 cursor-pointer active:scale-95 transition-all shadow-xs"
        >
          7
        </button>
        <button
          onClick={() => handleDigit('8')}
          className="h-11 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-white font-bold text-base border border-slate-700/40 cursor-pointer active:scale-95 transition-all shadow-xs"
        >
          8
        </button>
        <button
          onClick={() => handleDigit('9')}
          className="h-11 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-white font-bold text-base border border-slate-700/40 cursor-pointer active:scale-95 transition-all shadow-xs"
        >
          9
        </button>
        <button
          onClick={() => handleOperation('×')}
          className={`h-11 rounded-xl font-extrabold text-base flex items-center justify-center border cursor-pointer active:scale-95 transition-all ${
            operation === '×'
              ? 'bg-amber-500 text-slate-950 border-amber-400'
              : 'bg-[#02626D] hover:bg-[#037886] text-white border-teal-600/60'
          }`}
        >
          <Multiply size={17} />
        </button>

        {/* Row 3: 4, 5, 6, - */}
        <button
          onClick={() => handleDigit('4')}
          className="h-11 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-white font-bold text-base border border-slate-700/40 cursor-pointer active:scale-95 transition-all shadow-xs"
        >
          4
        </button>
        <button
          onClick={() => handleDigit('5')}
          className="h-11 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-white font-bold text-base border border-slate-700/40 cursor-pointer active:scale-95 transition-all shadow-xs"
        >
          5
        </button>
        <button
          onClick={() => handleDigit('6')}
          className="h-11 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-white font-bold text-base border border-slate-700/40 cursor-pointer active:scale-95 transition-all shadow-xs"
        >
          6
        </button>
        <button
          onClick={() => handleOperation('-')}
          className={`h-11 rounded-xl font-extrabold text-base flex items-center justify-center border cursor-pointer active:scale-95 transition-all ${
            operation === '-'
              ? 'bg-amber-500 text-slate-950 border-amber-400'
              : 'bg-[#02626D] hover:bg-[#037886] text-white border-teal-600/60'
          }`}
        >
          <Minus size={18} />
        </button>

        {/* Row 4: 1, 2, 3, + */}
        <button
          onClick={() => handleDigit('1')}
          className="h-11 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-white font-bold text-base border border-slate-700/40 cursor-pointer active:scale-95 transition-all shadow-xs"
        >
          1
        </button>
        <button
          onClick={() => handleDigit('2')}
          className="h-11 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-white font-bold text-base border border-slate-700/40 cursor-pointer active:scale-95 transition-all shadow-xs"
        >
          2
        </button>
        <button
          onClick={() => handleDigit('3')}
          className="h-11 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-white font-bold text-base border border-slate-700/40 cursor-pointer active:scale-95 transition-all shadow-xs"
        >
          3
        </button>
        <button
          onClick={() => handleOperation('+')}
          className={`h-11 rounded-xl font-extrabold text-base flex items-center justify-center border cursor-pointer active:scale-95 transition-all ${
            operation === '+'
              ? 'bg-amber-500 text-slate-950 border-amber-400'
              : 'bg-[#02626D] hover:bg-[#037886] text-white border-teal-600/60'
          }`}
        >
          <Plus size={18} />
        </button>

        {/* Row 5: +/-, 0, ., = */}
        <button
          onClick={handleToggleSign}
          className="h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm border border-slate-700/60 cursor-pointer active:scale-95 transition-all"
        >
          ±
        </button>
        <button
          onClick={() => handleDigit('0')}
          className="h-11 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-white font-bold text-base border border-slate-700/40 cursor-pointer active:scale-95 transition-all shadow-xs"
        >
          0
        </button>
        <button
          onClick={handleDecimal}
          className="h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-base border border-slate-700/60 cursor-pointer active:scale-95 transition-all"
        >
          .
        </button>
        <button
          onClick={handleEquals}
          className="h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg flex items-center justify-center border border-emerald-400/50 cursor-pointer active:scale-95 transition-all shadow-md"
        >
          <Equal size={20} />
        </button>
      </div>

      {/* ── 6. Bottom Helper Footer ─────────────────────────────────── */}
      <div className="px-3 py-1.5 bg-slate-950 text-center border-t border-slate-800/80">
        <span className="text-[10px] text-slate-500 font-medium">
          Keyboard: Digits, +, -, *, /, Enter, Backspace, Esc
        </span>
      </div>
    </div>
  );
}
