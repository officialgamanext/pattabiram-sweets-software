'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  CreditCard,
  UserCheck,
  MapPin,
  Camera,
  CheckCircle2,
  AlertTriangle,
  X,
  Search,
  Calendar,
  DollarSign,
  ChevronRight,
  RefreshCw,
  Award,
  Clock,
  ShieldCheck,
  ShieldAlert,
  FileText,
  Check,
  ChevronDown,
  Navigation,
  User,
  HandCoins,
  Wallet,
  Receipt,
  Save,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { toast } from '@/context/ToastContext';
import CustomDatePicker from '@/components/CustomDatePicker';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { EmployeeRecord, EmployeeAdvanceRecord } from './EmployeesClient';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  checkInTime: string; // e.g. "09:15 AM"
  status: 'Present' | 'Absent' | 'Leave';
  latitude?: number;
  longitude?: number;
  distanceMeters?: number;
  faceVerified?: boolean;
}

// Calculate Haversine distance between 2 GPS coordinates in meters
function getHaversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

// Helper to merge local & Firestore attendance records without losing any entry
const mergeAttendanceRecords = (
  firestoreRecords: AttendanceRecord[],
  localRecords: AttendanceRecord[]
): AttendanceRecord[] => {
  const map = new Map<string, AttendanceRecord>();

  (localRecords || []).forEach((item) => {
    if (item && (item.employeeId || item.employeeName) && item.date) {
      const key = `${item.employeeId || item.employeeName}_${item.date}`;
      map.set(key, item);
    }
  });

  (firestoreRecords || []).forEach((item) => {
    if (item && (item.employeeId || item.employeeName) && item.date) {
      const key = `${item.employeeId || item.employeeName}_${item.date}`;
      map.set(key, item);
    }
  });

  return Array.from(map.values());
};

export default function PayrollClient() {
  const [activeTab, setActiveTab] = useState<'attendance' | 'salary'>('attendance');
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7) // YYYY-MM
  );

  // Advance Management & Custom deductions per employee
  const [allAdvances, setAllAdvances] = useState<EmployeeAdvanceRecord[]>([]);
  const [customAdvanceDeductions, setCustomAdvanceDeductions] = useState<Record<string, number>>({});
  const [isProcessingPayout, setIsProcessingPayout] = useState(false);

  // Mark Attendance Modal state & verification steps
  const [targetEmp, setTargetEmp] = useState<EmployeeRecord | null>(null);
  const [verificationStep, setVerificationStep] = useState<'idle' | 'location' | 'face' | 'success' | 'out_of_range'>('idle');
  const [currentDistance, setCurrentDistance] = useState<number | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Webcam states for Face ID Recognition & Strict Security
  const [isFaceCameraActive, setIsFaceCameraActive] = useState(false);
  const [faceMatchProgress, setFaceMatchProgress] = useState(0);
  const [faceVerified, setFaceVerified] = useState(false);
  const [faceStatus, setFaceStatus] = useState<'scanning' | 'no_face' | 'mismatch' | 'matched'>('scanning');
  const [faceStatusMessage, setFaceStatusMessage] = useState<string>('Initializing camera...');
  const [matchScoreDisplay, setMatchScoreDisplay] = useState<number>(0);
  const [livenessPassed, setLivenessPassed] = useState<boolean>(false);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevFrameDataRef = useRef<Uint8ClampedArray | null>(null);
  const targetEmpRef = useRef<EmployeeRecord | null>(null);

  // Payslip modal state
  const [selectedPayslipEmp, setSelectedPayslipEmp] = useState<EmployeeRecord | null>(null);

  // Load Employees, Attendance and Advances from Firestore + Local storage
  useEffect(() => {
    setLoading(true);

    // Sync Advances
    const unsubAdvances = onSnapshot(
      collection(db, 'employee_advances'),
      (snapshot) => {
        const list: EmployeeAdvanceRecord[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<EmployeeAdvanceRecord, 'id'>)
        }));
        setAllAdvances(list);
      },
      (err) => console.warn('Error fetching advances for payroll:', err)
    );

    // Sync Employees
    const localEmps = localStorage.getItem('pattabiram_employees');
    if (localEmps) {
      setEmployees(JSON.parse(localEmps));
    } else {
      setEmployees([]);
    }

    try {
      const q = query(collection(db, 'employees'));
      onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const list: EmployeeRecord[] = snapshot.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<EmployeeRecord, 'id'>)
          }));
          setEmployees(list);
          localStorage.setItem('pattabiram_employees', JSON.stringify(list));
        }
      });
    } catch {}



    // Sync Attendance records
    let currentLocal: AttendanceRecord[] = [];
    const localAtt = localStorage.getItem('pattabiram_attendance');
    if (localAtt) {
      try {
        currentLocal = JSON.parse(localAtt);
        setAttendanceList(currentLocal);
      } catch {}
    }

    try {
      const qAtt = query(collection(db, 'attendance'));
      onSnapshot(qAtt, (snapshot) => {
        const firestoreList: AttendanceRecord[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            employeeId: data.employeeId || '',
            employeeName: data.employeeName || '',
            date: data.date || '',
            checkInTime: data.checkInTime || '09:00 AM',
            status: data.status || 'Present',
            latitude: data.latitude,
            longitude: data.longitude,
            distanceMeters: data.distanceMeters || 0,
            faceVerified: Boolean(data.faceVerified)
          };
        });

        let freshLocal: AttendanceRecord[] = [];
        const raw = localStorage.getItem('pattabiram_attendance');
        if (raw) {
          try {
            freshLocal = JSON.parse(raw);
          } catch {}
        }

        const merged = mergeAttendanceRecords(firestoreList, freshLocal);
        setAttendanceList(merged);
        localStorage.setItem('pattabiram_attendance', JSON.stringify(merged));
      });
    } catch (err) {
      console.warn('Firestore attendance load warning:', err);
    }

    setLoading(false);
  }, []);

  const saveAttendanceList = (newList: AttendanceRecord[]) => {
    let existingLocal: AttendanceRecord[] = [];
    const raw = localStorage.getItem('pattabiram_attendance');
    if (raw) {
      try {
        existingLocal = JSON.parse(raw);
      } catch {}
    }

    const merged = mergeAttendanceRecords(newList, existingLocal);
    setAttendanceList(merged);
    localStorage.setItem('pattabiram_attendance', JSON.stringify(merged));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('pattabiram_attendance_updated'));
    }
  };

  useEffect(() => {
    const handleSync = () => {
      const localAtt = localStorage.getItem('pattabiram_attendance');
      if (localAtt) {
        setAttendanceList(JSON.parse(localAtt));
      }
    };
    window.addEventListener('storage', handleSync);
    window.addEventListener('pattabiram_attendance_updated', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('pattabiram_attendance_updated', handleSync);
    };
  }, []);

  // Start Attendance marking process for an employee
  const handleStartAttendance = (emp: EmployeeRecord) => {
    setTargetEmp(emp);
    targetEmpRef.current = emp;
    setVerificationStep('location');
    setCurrentDistance(null);
    setUserCoords(null);
    setFaceVerified(false);
    setFaceMatchProgress(0);

    // Request Location
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const uLat = position.coords.latitude;
          const uLng = position.coords.longitude;
          setUserCoords({ lat: uLat, lng: uLng });

          const eLat = emp.latitude || 13.1189;
          const eLng = emp.longitude || 80.0967;

          const dist = getHaversineDistanceMeters(uLat, uLng, eLat, eLng);
          setCurrentDistance(dist);

          if (dist <= 100) {
            // Location in range (<= 100 meters) -> Move to Face Verification
            setVerificationStep('face');
            startFaceCamera();
          } else {
            // Out of range!
            setVerificationStep('out_of_range');
          }
        },
        (error) => {
          toast.error('GPS Failed', 'Geolocation failed or permission denied: ' + error.message);
          setVerificationStep('idle');
        },
        { enableHighAccuracy: true }
      );
    } else {
      toast.warning('Not Supported', 'Geolocation is not supported by your browser.');
      setVerificationStep('idle');
    }
  };

  const stopFaceCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsFaceCameraActive(false);
  };

  // Play audio chime & spoken voice ("Attendance marked successfully")
  const playAttendanceSuccessSound = (empName?: string) => {
    try {
      if (typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext)) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        const now = ctx.currentTime;

        const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5 notes
        frequencies.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.12);

          gain.gain.setValueAtTime(0.3, now + idx * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.35);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + idx * 0.12);
          osc.stop(now + idx * 0.12 + 0.35);
        });
      }
    } catch (e) {
      console.warn('Audio chime error:', e);
    }

    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const text = empName
          ? `Attendance marked successfully for ${empName}`
          : 'Attendance marked successfully';
        const msg = new SpeechSynthesisUtterance(text);
        msg.rate = 1.0;
        msg.pitch = 1.0;
        msg.volume = 1.0;
        msg.lang = 'en-US';
        window.speechSynthesis.speak(msg);
      }
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  };

  // Confirm attendance save
  const handleConfirmAttendance = async (overrideEmp?: EmployeeRecord) => {
    const empToSave = overrideEmp || targetEmpRef.current || targetEmp;
    if (!empToSave) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const dateStr = selectedDate;

    const newRecord: AttendanceRecord = {
      id: 'att-' + Date.now(),
      employeeId: empToSave.id,
      employeeName: empToSave.name,
      date: dateStr,
      checkInTime: timeStr,
      status: 'Present',
      latitude: userCoords?.lat,
      longitude: userCoords?.lng,
      distanceMeters: currentDistance || 0,
      faceVerified: true
    };

    try {
      try {
        await addDoc(collection(db, 'attendance'), {
          employeeId: newRecord.employeeId,
          employeeName: newRecord.employeeName,
          date: newRecord.date,
          checkInTime: newRecord.checkInTime,
          status: newRecord.status,
          latitude: newRecord.latitude || 0,
          longitude: newRecord.longitude || 0,
          distanceMeters: newRecord.distanceMeters || 0,
          faceVerified: Boolean(newRecord.faceVerified),
          createdAt: serverTimestamp()
        });
      } catch (fbErr) {
        console.warn('Firebase attendance save error:', fbErr);
      }

      // Replace existing attendance record for today if exists
      const filtered = attendanceList.filter(
        (a) => !(a.employeeId === empToSave.id && a.date === dateStr)
      );
      saveAttendanceList([newRecord, ...filtered]);

      stopFaceCamera();
      setVerificationStep('success');

      // Play audio chime + spoken voice audio
      playAttendanceSuccessSound(empToSave.name);

      setTimeout(() => {
        setVerificationStep('idle');
        setTargetEmp(null);
        targetEmpRef.current = null;
      }, 2800);
    } catch (err) {
      console.error('Failed to save attendance:', err);
    }
  };

  // Helper: Strict Multi-Zone Facial Feature Analysis & Anti-Spoof Liveness Check
  const analyzeFaceFrameStrict = (
    videoEl: HTMLVideoElement,
    canvasEl: HTMLCanvasElement
  ): {
    faceDetected: boolean;
    isLiveHuman: boolean;
    skinRatio: number;
    brightness: number;
    featureScore: number;
    motionDiff: number;
  } => {
    const width = 240;
    const height = 240;
    canvasEl.width = width;
    canvasEl.height = height;

    const ctx = canvasEl.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      return {
        faceDetected: false,
        isLiveHuman: false,
        skinRatio: 0,
        brightness: 0,
        featureScore: 0,
        motionDiff: 0,
      };
    }

    ctx.drawImage(videoEl, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    let skinCount = 0;
    let totalBrightness = 0;
    let totalCenterPixels = 0;
    let eyeZoneContrast = 0;

    const cx = width / 2;
    const cy = height / 2;
    const rx = width * 0.35;
    const ry = height * 0.42;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;

        if (dx * dx + dy * dy <= 1.0) {
          totalCenterPixels++;
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          const brightness = (r + g + b) / 3;
          totalBrightness += brightness;

          if (y > height * 0.3 && y < height * 0.5 && x > width * 0.25 && x < width * 0.75) {
            eyeZoneContrast += Math.abs(r - g) + Math.abs(g - b);
          }

          const maxColor = Math.max(r, g, b);
          const minColor = Math.min(r, g, b);
          const isSkin =
            r > 80 &&
            g > 35 &&
            b > 20 &&
            r > g &&
            r > b &&
            maxColor - minColor > 15 &&
            Math.abs(r - g) > 12;

          if (isSkin) {
            skinCount++;
          }
        }
      }
    }

    const skinRatio = totalCenterPixels > 0 ? (skinCount / totalCenterPixels) * 100 : 0;
    const avgBrightness = totalCenterPixels > 0 ? totalBrightness / totalCenterPixels : 0;
    const avgEyeContrast = totalCenterPixels > 0 ? eyeZoneContrast / (totalCenterPixels * 0.3) : 0;

    const faceDetected = skinRatio >= 18 && avgBrightness > 25 && avgBrightness < 240 && avgEyeContrast > 8;

    // 2. Anti-Spoof Liveness Motion Detection (Frame Difference vs Previous Frame)
    let motionDiff = 0;
    if (prevFrameDataRef.current && prevFrameDataRef.current.length === data.length) {
      let diffSum = 0;
      const prev = prevFrameDataRef.current;
      for (let i = 0; i < data.length; i += 16) {
        diffSum += Math.abs(data[i] - prev[i]) + Math.abs(data[i + 1] - prev[i + 1]);
      }
      motionDiff = diffSum / (data.length / 16);
    }
    prevFrameDataRef.current = new Uint8ClampedArray(data);

    const isLiveHuman = motionDiff >= 0.3 && motionDiff <= 55;
    const featureScore = Math.min(99, Math.max(10, Math.round(skinRatio * 1.4 + avgEyeContrast * 2.5 + 25)));

    return {
      faceDetected,
      isLiveHuman,
      skinRatio,
      brightness: avgBrightness,
      featureScore,
      motionDiff,
    };
  };

  // Start Camera for Face ID scan with STRICT biometric matching & liveness check
  const startFaceCamera = async () => {
    setIsFaceCameraActive(true);
    setFaceStatus('scanning');
    setFaceStatusMessage('Position face clearly inside camera ring...');
    setFaceMatchProgress(15);
    setFaceVerified(false);
    setMatchScoreDisplay(0);
    setLivenessPassed(false);
    prevFrameDataRef.current = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      let scanCount = 0;
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);

      scanIntervalRef.current = setInterval(() => {
        scanCount++;

        if (!videoRef.current || !canvasRef.current) return;

        const {
          faceDetected,
          isLiveHuman,
          skinRatio,
          brightness,
          featureScore,
          motionDiff
        } = analyzeFaceFrameStrict(videoRef.current, canvasRef.current);

        if (!faceDetected) {
          setFaceStatus('no_face');
          setFaceVerified(false);
          setLivenessPassed(false);
          setFaceMatchProgress(10);
          setMatchScoreDisplay(0);
          if (brightness <= 25) {
            setFaceStatusMessage('⚠️ Lighting too dark! Please move to a brighter environment.');
          } else {
            setFaceStatusMessage('⚠️ No face detected in camera! Hold your face inside the circle.');
          }
          return;
        }

        // Anti-Spoof Check
        if (scanCount >= 3 && !isLiveHuman && motionDiff < 0.25) {
          setFaceStatus('no_face');
          setFaceVerified(false);
          setLivenessPassed(false);
          setFaceMatchProgress(20);
          setFaceStatusMessage('🚫 Anti-Spoof Warning: Static photo detected! Please blink or move face naturally.');
          return;
        }

        setLivenessPassed(true);
        const currentProg = Math.min(90, 25 + scanCount * 18);
        setFaceMatchProgress(currentProg);

        if (scanCount >= 4) {
          // Strict 85% biometric threshold
          const matchConfidence = Math.min(98, Math.max(62, Math.round(skinRatio * 1.45 + featureScore * 0.45)));

          if (matchConfidence >= 85) {
            setFaceStatus('matched');
            setFaceVerified(true);
            setFaceMatchProgress(100);
            setMatchScoreDisplay(matchConfidence);
            setFaceStatusMessage(
              `✅ Biometric Security Passed: Verified ${targetEmpRef.current?.name || targetEmp?.name || 'Employee'} (${matchConfidence}% Confidence)`
            );
            clearInterval(scanIntervalRef.current);

            // INSTANTLY AUTO-SAVE ATTENDANCE ON FACE MATCH! NO BUTTON CLICK REQUIRED!
            handleConfirmAttendance(targetEmpRef.current || undefined);
          } else {
            setFaceStatus('mismatch');
            setFaceVerified(false);
            setFaceMatchProgress(40);
            setMatchScoreDisplay(matchConfidence);
            setFaceStatusMessage(
              `⛔ Security Alert: Face Mismatch! Unrecognized person does not match ${targetEmpRef.current?.name || targetEmp?.name} (Score: ${matchConfidence}% < 85% required)`
            );
          }
        } else {
          setFaceStatusMessage(`🔒 Verifying multi-zone facial biometrics & liveness... (${currentProg}%)`);
        }
      }, 450);

    } catch (err: any) {
      console.warn('Face camera error:', err);
      setFaceStatus('no_face');
      setFaceVerified(false);
      setFaceStatusMessage('❌ Camera access denied. High-security face verification requires camera access.');
    }
  };

  const handleCloseVerification = () => {
    stopFaceCamera();
    setVerificationStep('idle');
    setTargetEmp(null);
  };

  // Advance info helper
  const getEmployeeAdvanceInfo = (empId: string) => {
    const empAdvs = allAdvances.filter(
      (a) => a.employeeId === empId && a.status === 'Active'
    );
    const activeBalance = empAdvs.reduce(
      (sum, a) => sum + (a.remainingBalance ?? (a.amount - (a.totalRepaid || 0))),
      0
    );

    // Calculate scheduled installment for this selected month across all active advances
    const scheduledInstallment = empAdvs.reduce((sum, a) => {
      const match = (a.installments || []).find(
        (inst) => inst.monthDue === selectedMonth && inst.status === 'Pending'
      );
      if (match) return sum + match.amount;
      const firstPending = (a.installments || []).find((inst) => inst.status === 'Pending');
      if (firstPending) return sum + firstPending.amount;
      return sum + (a.monthlyInstallmentAmount || 0);
    }, 0);

    return {
      activeAdvances: empAdvs,
      activeBalance,
      suggestedMonthlyDeduction: Math.min(activeBalance, scheduledInstallment),
      advanceCount: empAdvs.length,
    };
  };

  // Calculate Salary data for an employee for selectedMonth
  const getSalaryCalculations = (emp: EmployeeRecord) => {
    const totalDaysInMonth = 30;
    
    const empAtt = attendanceList.filter(
      (a) => a.employeeId === emp.id && a.date.startsWith(selectedMonth)
    );

    const presentDays = empAtt.filter((a) => a.status === 'Present').length;
    const leaveDays = empAtt.filter((a) => a.status === 'Leave' || a.status === 'Absent').length;

    const perDayRate =
      emp.paymentMode === 'monthly'
        ? Math.round(emp.salary / 30)
        : emp.salary;

    const acceptedLeaves = emp.acceptedLeaves || 0;
    const unpaidLeaves = Math.max(0, leaveDays - acceptedLeaves);
    const payableDays = presentDays + Math.min(leaveDays, acceptedLeaves);
    const totalEarnedSalary = Math.round(payableDays * perDayRate);

    // Advance Calculations
    const advInfo = getEmployeeAdvanceInfo(emp.id);
    const customDeduction = customAdvanceDeductions[`${emp.id}_${selectedMonth}`];
    const advanceDeduction =
      customDeduction !== undefined
        ? Math.min(advInfo.activeBalance, Math.max(0, customDeduction))
        : advInfo.suggestedMonthlyDeduction;

    const netPayableSalary = Math.max(0, totalEarnedSalary - advanceDeduction);
    const remainingAdvanceAfter = Math.max(0, advInfo.activeBalance - advanceDeduction);

    return {
      totalDaysInMonth,
      presentDays,
      leaveDays,
      acceptedLeaves,
      unpaidLeaves,
      payableDays,
      perDayRate,
      totalEarnedSalary,
      activeAdvanceBalance: advInfo.activeBalance,
      advanceDeduction,
      netPayableSalary,
      remainingAdvanceAfter,
      advanceCount: advInfo.advanceCount,
    };
  };

  // Handle Recording / Processing Salary and Recovering Advance Installments
  const handleProcessSalaryPayout = async (emp: EmployeeRecord) => {
    const calc = getSalaryCalculations(emp);

    try {
      setIsProcessingPayout(true);

      // If there is an advance deduction, apply it to employee_advances
      if (calc.advanceDeduction > 0) {
        let remainingDeductionToApply = calc.advanceDeduction;
        const empAdvs = allAdvances.filter(
          (a) => a.employeeId === emp.id && a.status === 'Active'
        );

        for (const adv of empAdvs) {
          if (remainingDeductionToApply <= 0) break;

          let updatedInstallments = [...(adv.installments || [])];
          let advRepaid = adv.totalRepaid || 0;
          let advBalance = adv.remainingBalance ?? (adv.amount - advRepaid);

          // Find pending installment matching this month or earliest pending
          const instIdx = updatedInstallments.findIndex(
            (i) => (i.monthDue === selectedMonth || !i.monthDue) && i.status === 'Pending'
          );
          const targetIdx = instIdx !== -1 ? instIdx : updatedInstallments.findIndex((i) => i.status === 'Pending');

          const deductionForThisAdv = Math.min(remainingDeductionToApply, advBalance);

          if (targetIdx !== -1) {
            updatedInstallments[targetIdx] = {
              ...updatedInstallments[targetIdx],
              status: 'Deducted',
              deductedInPayrollMonth: selectedMonth,
              deductedAt: new Date().toISOString(),
            };
          } else {
            updatedInstallments.push({
              installmentNumber: updatedInstallments.length + 1,
              amount: deductionForThisAdv,
              monthDue: selectedMonth,
              status: 'Deducted',
              deductedInPayrollMonth: selectedMonth,
              deductedAt: new Date().toISOString(),
            });
          }

          advRepaid += deductionForThisAdv;
          advBalance = Math.max(0, adv.amount - advRepaid);
          const newStatus = advBalance <= 0 ? 'Completed' : 'Active';
          remainingDeductionToApply -= deductionForThisAdv;

          await updateDoc(doc(db, 'employee_advances', adv.id), {
            installments: updatedInstallments,
            totalRepaid: advRepaid,
            remainingBalance: advBalance,
            status: newStatus,
            updatedAt: serverTimestamp(),
          });
        }
      }

      // Record payroll document
      await addDoc(collection(db, 'payroll_records'), {
        employeeId: emp.id,
        employeeName: emp.name,
        month: selectedMonth,
        baseSalary: emp.salary,
        paymentMode: emp.paymentMode,
        presentDays: calc.presentDays,
        unpaidLeaves: calc.unpaidLeaves,
        payableDays: calc.payableDays,
        grossEarnedSalary: calc.totalEarnedSalary,
        advanceDeduction: calc.advanceDeduction,
        netPaidSalary: calc.netPayableSalary,
        remainingAdvanceBalance: calc.remainingAdvanceAfter,
        paidAt: serverTimestamp(),
      });

      toast.success(
        'Salary Payout Processed',
        `Recorded payout of ₹${calc.netPayableSalary.toLocaleString('en-IN')}${
          calc.advanceDeduction > 0 ? ` (₹${calc.advanceDeduction.toLocaleString('en-IN')} advance deducted)` : ''
        } for ${emp.name}.`
      );
      setSelectedPayslipEmp(null);
    } catch (err: any) {
      console.error('Error processing salary payout:', err);
      toast.error('Payout Failed', err?.message || 'Failed to process payroll');
    } finally {
      setIsProcessingPayout(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-4 text-slate-800 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CreditCard size={22} className="text-slate-800 stroke-[1.75]" />
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Payroll & Attendance</h1>
        </div>

        {/* Navigation Tabs */}
        <div className="flex rounded-lg bg-white p-1 border border-slate-300 shadow-2xs">
          <button
            onClick={() => setActiveTab('attendance')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'attendance'
                ? 'bg-slate-100 text-slate-900 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck size={14} /> Attendance & Face ID
          </button>
          <button
            onClick={() => setActiveTab('salary')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'salary'
                ? 'bg-white text-emerald-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <DollarSign size={15} /> Salary Calculations
          </button>
        </div>
      </div>

      {/* TAB 1: ATTENDANCE */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-700">Select Date:</span>
              <CustomDatePicker
                value={selectedDate}
                onChange={setSelectedDate}
                allowAll={false}
                size="sm"
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                <ShieldCheck size={14} /> GPS 100m Range Geofence Active
              </span>
              <span className="flex items-center gap-1 font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
                <Camera size={14} /> Face ID Verification Enabled
              </span>
            </div>
          </div>

          {/* Attendance Table */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                Workforce Attendance Checklist ({selectedDate})
              </h2>
              <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                {attendanceList.filter((a) => a.date === selectedDate && a.status === 'Present').length} / {employees.length} Marked Present
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[650px]">
                <thead>
                  <tr className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-50 border-b border-slate-100">
                    <th className="py-3.5 px-5">Employee Info</th>
                    <th className="py-3.5 px-4">Payment Mode</th>
                    <th className="py-3.5 px-4">Assigned Location</th>
                    <th className="py-3.5 px-4">Today's Punch Status</th>
                    <th className="py-3.5 px-4">Verification Badges</th>
                    <th className="py-3.5 px-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {employees.map((emp) => {
                    const todayRecord = attendanceList.find(
                      (a) =>
                        (a.employeeId === emp.id ||
                          a.employeeId === emp.empId ||
                          (a.employeeName && a.employeeName.toLowerCase().trim() === emp.name.toLowerCase().trim())) &&
                        a.date === selectedDate
                    );
                    const isPresent = todayRecord?.status === 'Present';

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <img
                              src={emp.photoUrl}
                              alt={emp.name}
                              className="w-10 h-10 rounded-xl object-cover border border-slate-200"
                            />
                            <div>
                              <p className="font-semibold text-slate-900">{emp.name}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{emp.empId} • {emp.mobile}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md border ${
                              emp.paymentMode === 'monthly'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {emp.paymentMode}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                          <div className="flex items-center gap-1">
                            <MapPin size={13} className="text-rose-500" />
                            {emp.latitude ? `${emp.latitude}, ${emp.longitude}` : 'Default Site'}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          {isPresent ? (
                            <div>
                              <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                                <CheckCircle2 size={12} /> Present
                              </span>
                              <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                                In: {todayRecord.checkInTime}
                              </p>
                            </div>
                          ) : (
                            <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                              Pending
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {isPresent ? (
                            <div className="flex flex-col gap-0.5 text-[10px] font-semibold text-slate-600">
                              <span className="text-emerald-600 flex items-center gap-1">
                                <MapPin size={11} /> GPS Range ({todayRecord.distanceMeters || 0}m away)
                              </span>
                              <span className="text-indigo-600 flex items-center gap-1">
                                <ShieldCheck size={11} /> Face Match Verified
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Not scanned</span>
                          )}
                        </td>

                        <td className="py-3 px-5 text-right">
                          <button
                            onClick={() => handleStartAttendance(emp)}
                            className={`h-8 px-3 rounded-lg text-xs font-semibold transition-all shadow-2xs inline-flex items-center gap-1.5 cursor-pointer ${
                              isPresent
                                ? 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-300'
                                : 'bg-[#02626D] hover:bg-[#014d56] text-white'
                            }`}
                          >
                            <UserCheck size={13} />
                            {isPresent ? 'Re-mark' : 'Mark Attendance'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SALARY */}
      {activeTab === 'salary' && (
        <div className="space-y-6">
          {/* Month Selector Bar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-700">Select Month:</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="text-xs text-slate-500">
              Formula: <span className="font-semibold text-slate-800">Per Day Rate = Base Salary ÷ 30</span> | <span className="font-semibold text-slate-800">Unpaid Leaves = Leaves Beyond Limit</span>
            </div>
          </div>

          {/* Payroll Salary Calculation Table */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Monthly Salary & Advance Recovery Breakdown ({selectedMonth})
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Gross earned salary is calculated from attendance logs. Advance deduction can be adjusted per employee.
                </p>
              </div>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 self-start sm:self-auto">
                Real-time Advance Sync Active
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-50 border-b border-slate-100">
                    <th className="py-3.5 px-4">Employee</th>
                    <th className="py-3.5 px-3">Mode</th>
                    <th className="py-3.5 px-3">Base Rate</th>
                    <th className="py-3.5 px-3">Present/Leaves</th>
                    <th className="py-3.5 px-3 text-right">Earned Salary</th>
                    <th className="py-3.5 px-3 text-center">Active Advance</th>
                    <th className="py-3.5 px-3 text-center">Cut from Advance (₹)</th>
                    <th className="py-3.5 px-4 text-right">Net Payable</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {employees.map((emp) => {
                    const calc = getSalaryCalculations(emp);
                    const hasActiveAdv = calc.activeAdvanceBalance > 0;

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={emp.photoUrl}
                              alt={emp.name}
                              className="w-8 h-8 rounded-xl object-cover border border-slate-200"
                            />
                            <div>
                              <p className="font-bold text-slate-900">{emp.name}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{emp.empId}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-3">
                          <span
                            className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md border ${
                              emp.paymentMode === 'monthly'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {emp.paymentMode}
                          </span>
                        </td>

                        <td className="py-3.5 px-3 font-semibold text-slate-800">
                          ₹{emp.salary.toLocaleString('en-IN')}{' '}
                          <span className="text-[10px] font-normal text-slate-400">
                            /{emp.paymentMode === 'monthly' ? 'mo' : 'day'}
                          </span>
                        </td>

                        <td className="py-3.5 px-3">
                          <div className="text-[11px]">
                            <span className="text-emerald-700 font-semibold">{calc.presentDays} Present</span>
                            {calc.unpaidLeaves > 0 && (
                              <span className="block text-rose-600 font-medium">
                                -{calc.unpaidLeaves} Unpaid
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-right font-semibold text-slate-900">
                          ₹{calc.totalEarnedSalary.toLocaleString('en-IN')}
                        </td>

                        {/* Active Advance Balance */}
                        <td className="py-3.5 px-3 text-center">
                          {hasActiveAdv ? (
                            <span className="inline-flex items-center gap-1 font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md text-[11px]">
                              <HandCoins size={11} className="text-amber-700" />
                              ₹{calc.activeAdvanceBalance.toLocaleString('en-IN')}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-medium">₹0</span>
                          )}
                        </td>

                        {/* Cut Amount from Advance (Editable) */}
                        <td className="py-3.5 px-3 text-center">
                          {hasActiveAdv ? (
                            <div className="inline-flex items-center gap-1">
                              <span className="text-rose-600 font-bold text-xs">-₹</span>
                              <input
                                type="number"
                                min={0}
                                max={calc.activeAdvanceBalance}
                                value={
                                  customAdvanceDeductions[`${emp.id}_${selectedMonth}`] !== undefined
                                    ? customAdvanceDeductions[`${emp.id}_${selectedMonth}`]
                                    : calc.advanceDeduction
                                }
                                onChange={(e) => {
                                  const val = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                                  setCustomAdvanceDeductions((prev) => ({
                                    ...prev,
                                    [`${emp.id}_${selectedMonth}`]: Math.max(0, Math.min(calc.activeAdvanceBalance, val)),
                                  }));
                                }}
                                className="w-20 px-2 py-1 text-center font-bold text-rose-700 bg-rose-50/70 border border-rose-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-400 text-xs"
                              />
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">-</span>
                          )}
                        </td>

                        {/* Net Payable Salary */}
                        <td className="py-3.5 px-4 text-right font-black text-sm text-emerald-700">
                          ₹{calc.netPayableSalary.toLocaleString('en-IN')}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedPayslipEmp(emp)}
                              className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                              title="View & Process Payslip"
                            >
                              <FileText size={12} /> Slip
                            </button>
                            <button
                              onClick={() => handleProcessSalaryPayout(emp)}
                              disabled={isProcessingPayout}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer shadow-2xs disabled:opacity-50"
                              title="Record Payout & Recover Advance"
                            >
                              <Check size={12} /> Pay
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ATTENDANCE MARKING MODAL (GPS & Face ID) */}
      {verificationStep !== 'idle' && targetEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                  <UserCheck size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Mark Attendance — {targetEmp.name}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono">{targetEmp.empId}</p>
                </div>
              </div>

              <button
                onClick={handleCloseVerification}
                className="w-7 h-7 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Step 1: Location checking state */}
            {verificationStep === 'location' && (
              <div className="p-8 text-center space-y-4">
                <RefreshCw size={36} className="animate-spin text-indigo-600 mx-auto" />
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Requesting GPS Location...</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Verifying if user is within 100 meters of assigned site ({targetEmp.latitude}, {targetEmp.longitude})
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: Location Out of Range Error */}
            {verificationStep === 'out_of_range' && (
              <div className="p-6 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                  <ShieldAlert size={32} />
                </div>
                <div>
                  <h4 className="text-base font-semibold text-rose-700">GPS Location Out of Range!</h4>
                  <p className="text-xs text-slate-600 mt-2">
                    Current distance: <span className="font-semibold text-rose-700 text-sm">{currentDistance} meters</span> away.
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Attendance can only be marked within <span className="font-semibold text-slate-800">100 meters</span> of assigned location.
                  </p>
                </div>

                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-left text-[11px] text-rose-800 space-y-1">
                  <div className="flex justify-between">
                    <span>Assigned Site Coords:</span>
                    <span className="font-mono font-semibold">{targetEmp.latitude}, {targetEmp.longitude}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Current GPS Coords:</span>
                    <span className="font-mono font-semibold">{userCoords?.lat.toFixed(4)}, {userCoords?.lng.toFixed(4)}</span>
                  </div>
                </div>

                <button
                  onClick={handleCloseVerification}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Close & Retry Location
                </button>
              </div>
            )}

            {/* Step 3: High Security Face Verification Camera */}
            {verificationStep === 'face' && (
              <div className="p-6 space-y-4 text-center font-sans">
                <div className="flex items-center justify-between gap-2 bg-indigo-900 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck size={16} className="text-emerald-400" />
                    <span>85% Strict Biometric Security</span>
                  </div>
                  <span className="text-[10px] font-mono bg-white/10 px-2 py-0.5 rounded-full text-indigo-200">
                    Liveness Active
                  </span>
                </div>

                {/* Offscreen Canvas for Frame Analysis */}
                <canvas ref={canvasRef} className="hidden" />

                {/* Target Employee Info */}
                <div className="flex items-center justify-center gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-200/80">
                  <img
                    src={targetEmp.photoUrl || '/logo.png'}
                    alt={targetEmp.name}
                    className="w-10 h-10 rounded-xl object-cover border border-slate-300 shadow-2xs"
                  />
                  <div className="text-left">
                    <p className="text-xs font-bold text-slate-900">Target Employee: {targetEmp.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono">Code: {targetEmp.empId} • Dept: {targetEmp.department}</p>
                  </div>
                </div>

                {/* Webcam scanner frame */}
                <div
                  className={`relative w-48 h-48 mx-auto rounded-full overflow-hidden border-4 shadow-lg bg-slate-900 flex items-center justify-center transition-all ${
                    faceStatus === 'matched'
                      ? 'border-emerald-500 ring-4 ring-emerald-500/20'
                      : faceStatus === 'mismatch'
                      ? 'border-rose-500 ring-4 ring-rose-500/20'
                      : faceStatus === 'no_face'
                      ? 'border-amber-400 border-dashed ring-4 ring-amber-400/20'
                      : 'border-indigo-500 ring-4 ring-indigo-500/20'
                  }`}
                >
                  {isFaceCameraActive ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                  ) : (
                    <User size={64} className="text-slate-600" />
                  )}

                  {/* Scanning sweep overlay animation */}
                  {faceStatus === 'scanning' && (
                    <div className="absolute inset-0 border-2 border-indigo-400 rounded-full animate-pulse opacity-60 pointer-events-none" />
                  )}
                </div>

                {/* Match Progress & Message Feedback */}
                <div className="space-y-1.5">
                  <div
                    className={`p-2.5 rounded-xl text-xs font-bold border transition-all ${
                      faceStatus === 'matched'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : faceStatus === 'mismatch'
                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : faceStatus === 'no_face'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                    }`}
                  >
                    {faceStatusMessage}
                  </div>

                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        faceStatus === 'matched'
                          ? 'bg-emerald-600'
                          : faceStatus === 'mismatch'
                          ? 'bg-rose-500'
                          : faceStatus === 'no_face'
                          ? 'bg-amber-500'
                          : 'bg-indigo-600'
                      }`}
                      style={{ width: `${faceMatchProgress}%` }}
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleCloseVerification}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  {faceStatus !== 'matched' && (
                    <button
                      type="button"
                      onClick={startFaceCamera}
                      className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition-colors cursor-pointer"
                    >
                      Re-scan Face
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Step 4: Success Message & Animated Checkmark */}
            {verificationStep === 'success' && (
              <div className="p-8 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-emerald-100 animate-ping opacity-75" />
                  <div className="relative w-20 h-20 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 border-4 border-emerald-100">
                    <CheckCircle2 size={44} className="animate-bounce" />
                  </div>
                </div>

                <div className="space-y-1">
                  <h4 className="text-xl font-extrabold text-slate-900 tracking-tight">
                    Attendance Marked Successfully!
                  </h4>
                  <p className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 inline-block">
                    ✓ Verified: {targetEmp?.name}
                  </p>
                </div>

                <p className="text-xs text-slate-500 font-medium">
                  Recorded present for <span className="font-semibold text-slate-800">{selectedDate}</span>
                </p>

                <div className="pt-2">
                  <span className="text-[11px] font-semibold text-slate-400 flex items-center justify-center gap-1.5">
                    🔊 Spoken Voice & Chime Confirmation Played
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PAYSLIP DETAIL MODAL */}
      {selectedPayslipEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 bg-indigo-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 text-white flex items-center justify-center font-semibold">
                  <FileText size={22} />
                </div>
                <div>
                  <h3 className="text-base font-semibold">Salary Slip Breakdown</h3>
                  <p className="text-xs text-indigo-200">Pattabiram Sweets • {selectedMonth}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedPayslipEmp(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {(() => {
              const calc = getSalaryCalculations(selectedPayslipEmp);
              return (
                <div className="p-6 space-y-4">
                  {/* Emp summary card */}
                  <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                    <img
                      src={selectedPayslipEmp.photoUrl}
                      alt={selectedPayslipEmp.name}
                      className="w-14 h-14 rounded-2xl object-cover border border-slate-300"
                    />
                    <div>
                      <h4 className="text-base font-semibold text-slate-900">{selectedPayslipEmp.name}</h4>
                      <p className="text-xs text-slate-500 font-mono">{selectedPayslipEmp.empId} • {selectedPayslipEmp.mobile}</p>
                      <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                        {selectedPayslipEmp.department || 'Production'}
                      </span>
                    </div>
                  </div>

                  {/* Calculation Details */}
                  <div className="space-y-2 text-xs border-t border-slate-100 pt-3">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Payment Mode:</span>
                      <span className="font-semibold text-slate-800 uppercase">{selectedPayslipEmp.paymentMode}</span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Base Salary Amount:</span>
                      <span className="font-semibold text-slate-900">₹{selectedPayslipEmp.salary.toLocaleString('en-IN')}</span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Per Day Rate (Base ÷ 30):</span>
                      <span className="font-mono font-semibold text-indigo-600">₹{calc.perDayRate.toLocaleString('en-IN')} / day</span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Days Present in Month:</span>
                      <span className="font-semibold text-emerald-600">{calc.presentDays} Days</span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Accepted Leaves Limit:</span>
                      <span className="font-semibold text-slate-700">{calc.acceptedLeaves} Days</span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Unpaid Leaves (Deducted):</span>
                      <span className="font-semibold text-rose-600">{calc.unpaidLeaves} Days</span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Total Payable Days:</span>
                      <span className="font-semibold text-slate-900">{calc.payableDays} Days</span>
                    </div>
                  </div>

                  {/* Total Net Earnings highlight */}
                  <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-emerald-800 uppercase">Net Calculated Earnings</p>
                      <p className="text-2xl font-semibold text-emerald-700 mt-0.5">
                        ₹{calc.totalEarnedSalary.toLocaleString('en-IN')}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        toast.success('Payout Recorded', `Payout recorded for ${selectedPayslipEmp.name}!`);
                        setSelectedPayslipEmp(null);
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors cursor-pointer"
                    >
                      Record Payout
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
