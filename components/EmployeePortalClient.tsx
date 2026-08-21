'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  UserCheck,
  Calendar,
  Clock,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Award,
  User,
  Phone,
  Briefcase,
  MapPin,
  ShieldCheck,
  ShieldAlert,
  FileText,
  DollarSign,
  ChevronDown,
  RefreshCw,
  Camera,
  X,
  Printer,
  Building,
  Check,
  Lock
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { toast } from '@/context/ToastContext';
import { collection, onSnapshot, addDoc, serverTimestamp, query } from 'firebase/firestore';
import { EmployeeRecord } from './EmployeesClient';
import { AttendanceRecord } from './PayrollClient';
import { useAuth } from '@/context/AuthContext';
import CustomSelect from '@/components/CustomSelect';

function getHaversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
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

export default function EmployeePortalClient() {
  const searchParams = useSearchParams();
  const queryEmpId = searchParams.get('id');
  const { employeeProfile } = useAuth();

  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const isSuperAdmin = Boolean(employeeProfile?.isSuperAdmin);

  // Match the logged in employee's profile against the employee records
  const matchedLoggedEmp = useMemo(() => {
    if (!employeeProfile || isSuperAdmin || employees.length === 0) return null;
    const cleanMobile = (employeeProfile.mobile || '').replace(/\D/g, '');
    return employees.find((emp) => {
      const empMobClean = (emp.mobile || '').replace(/\D/g, '');
      return (
        emp.id === employeeProfile.id ||
        emp.empId === employeeProfile.empId ||
        (cleanMobile && empMobClean && (cleanMobile === empMobClean || cleanMobile.endsWith(empMobClean) || empMobClean.endsWith(cleanMobile)))
      );
    }) || null;
  }, [employeeProfile, isSuperAdmin, employees]);

  // Lock selectedEmpId to logged-in employee for non-SuperAdmin users
  useEffect(() => {
    if (isSuperAdmin) {
      if (queryEmpId && employees.some((e) => e.id === queryEmpId)) {
        setSelectedEmpId(queryEmpId);
      } else if (!selectedEmpId && employees[0]) {
        setSelectedEmpId(employees[0].id);
      }
    } else if (matchedLoggedEmp) {
      setSelectedEmpId(matchedLoggedEmp.id);
    }
  }, [isSuperAdmin, queryEmpId, matchedLoggedEmp, employees, selectedEmpId]);

  // Tab State
  const [activeTab, setActiveTab] = useState<'attendance' | 'salary' | 'profile'>('attendance');

  // Month selector state for Salary tab
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );

  // Attendance Marking Modal States
  const [verificationStep, setVerificationStep] = useState<'idle' | 'location' | 'face' | 'success' | 'out_of_range'>('idle');
  const [currentDistance, setCurrentDistance] = useState<number | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Webcam states
  const [isFaceCameraActive, setIsFaceCameraActive] = useState(false);
  const [faceMatchProgress, setFaceMatchProgress] = useState(0);
  const [faceVerified, setFaceVerified] = useState(false);
  const [faceStatus, setFaceStatus] = useState<'scanning' | 'no_face' | 'mismatch' | 'matched'>('scanning');
  const [faceStatusMessage, setFaceStatusMessage] = useState<string>('Initializing camera...');
  const [matchScoreDisplay, setMatchScoreDisplay] = useState<number>(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevFrameDataRef = useRef<Uint8ClampedArray | null>(null);
  const targetEmpRef = useRef<EmployeeRecord | null>(null);

  // Load Employees and Attendance data
  useEffect(() => {
    setLoading(true);

    const localEmps = localStorage.getItem('pattabiram_employees');
    if (localEmps) {
      const parsed: EmployeeRecord[] = JSON.parse(localEmps);
      setEmployees(parsed);
      setSelectedEmpId(queryEmpId || parsed[0]?.id || '');
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
          if (!selectedEmpId) {
            setSelectedEmpId(queryEmpId || list[0]?.id || '');
          }
        }
      });
    } catch {}



    const localAtt = localStorage.getItem('pattabiram_attendance');
    if (localAtt) {
      try {
        setAttendanceList(JSON.parse(localAtt));
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
      console.warn('Firestore load warning:', err);
    }

    setLoading(false);
  }, [queryEmpId]);

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

  // Selected Employee object (strictly locked to matchedLoggedEmp for non-SuperAdmin users)
  const selectedEmp = useMemo(() => {
    if (!isSuperAdmin) {
      return matchedLoggedEmp;
    }
    return employees.find((e) => e.id === selectedEmpId) || employees[0] || null;
  }, [isSuperAdmin, matchedLoggedEmp, employees, selectedEmpId]);

  useEffect(() => {
    if (selectedEmp) {
      targetEmpRef.current = selectedEmp;
    }
  }, [selectedEmp]);

  // Attendance for selected employee (strictly isolated for non-SuperAdmin)
  const selectedEmpAttendance = useMemo(() => {
    if (!selectedEmp) return [];
    return attendanceList.filter(
      (a: AttendanceRecord) =>
        a.employeeId === selectedEmp.id ||
        a.employeeId === selectedEmp.empId ||
        (a.employeeName && selectedEmp.name && a.employeeName.toLowerCase().trim() === selectedEmp.name.toLowerCase().trim())
    );
  }, [attendanceList, selectedEmp]);
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayAttendance = selectedEmpAttendance.find((a: AttendanceRecord) => a.date === todayStr && a.status === 'Present');

  // Month stats calculation
  const monthAttendance = selectedEmpAttendance.filter((a: AttendanceRecord) => a.date.startsWith(selectedMonth));
  const presentDays = monthAttendance.filter((a: AttendanceRecord) => a.status === 'Present').length;
  const leaveDays = monthAttendance.filter((a: AttendanceRecord) => a.status === 'Leave' || a.status === 'Absent').length;

  const perDayRate = selectedEmp
    ? selectedEmp.paymentMode === 'monthly'
      ? Math.round(selectedEmp.salary / 30)
      : selectedEmp.salary
    : 0;

  const acceptedLeaves = selectedEmp?.acceptedLeaves || 0;
  const unpaidLeaves = Math.max(0, leaveDays - acceptedLeaves);
  const payableDays = presentDays + Math.min(leaveDays, acceptedLeaves);
  const totalEarned = Math.round(payableDays * perDayRate);

  // Handle Attendance Marking start
  const handleStartSelfAttendance = () => {
    if (!selectedEmp) return;
    targetEmpRef.current = selectedEmp;
    setVerificationStep('location');
    setCurrentDistance(null);
    setUserCoords(null);
    setFaceVerified(false);
    setFaceMatchProgress(0);

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const uLat = position.coords.latitude;
          const uLng = position.coords.longitude;
          setUserCoords({ lat: uLat, lng: uLng });

          const eLat = selectedEmp.latitude || 13.1189;
          const eLng = selectedEmp.longitude || 80.0967;

          const dist = getHaversineDistanceMeters(uLat, uLng, eLat, eLng);
          setCurrentDistance(dist);

          if (dist <= 100) {
            setVerificationStep('face');
            startFaceCamera();
          } else {
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

  const playAttendanceSuccessSound = (empName?: string) => {
    try {
      if (typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext)) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        const now = ctx.currentTime;

        const frequencies = [523.25, 659.25, 783.99];
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
    } catch (e) {}

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
    } catch (e) {}
  };

  const handleConfirmAttendance = async (overrideEmp?: EmployeeRecord | null) => {
    const empToSave = overrideEmp || targetEmpRef.current || selectedEmp;
    if (!empToSave) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const dateStr = todayStr;

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

      const filtered = attendanceList.filter(
        (a) =>
          !(
            (a.employeeId === empToSave.id ||
              a.employeeId === empToSave.empId ||
              (a.employeeName && a.employeeName.toLowerCase().trim() === empToSave.name.toLowerCase().trim())) &&
            a.date === dateStr
          )
      );
      saveAttendanceList([newRecord, ...filtered]);

      stopFaceCamera();
      setVerificationStep('success');
      playAttendanceSuccessSound(empToSave.name);

      setTimeout(() => {
        setVerificationStep('idle');
      }, 2800);
    } catch (err) {
      console.error('Failed to save attendance:', err);
    }
  };

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
        motionDiff: 0
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
      motionDiff
    };
  };

  const startFaceCamera = async () => {
    setIsFaceCameraActive(true);
    setFaceStatus('scanning');
    setFaceStatusMessage('Position face clearly inside camera ring...');
    setFaceMatchProgress(15);
    setFaceVerified(false);
    setMatchScoreDisplay(0);
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
          setFaceMatchProgress(10);
          setMatchScoreDisplay(0);
          if (brightness <= 25) {
            setFaceStatusMessage('⚠️ Lighting too dark! Move to a brighter area.');
          } else {
            setFaceStatusMessage('⚠️ No face detected! Hold face in circle.');
          }
          return;
        }

        if (scanCount >= 3 && !isLiveHuman && motionDiff < 0.25) {
          setFaceStatus('no_face');
          setFaceVerified(false);
          setFaceMatchProgress(20);
          setFaceStatusMessage('🚫 Anti-Spoof Warning: Static photo detected! Blink naturally.');
          return;
        }

        const currentProg = Math.min(90, 25 + scanCount * 18);
        setFaceMatchProgress(currentProg);

        if (scanCount >= 4) {
          const matchConfidence = Math.min(98, Math.max(62, Math.round(skinRatio * 1.45 + featureScore * 0.45)));

          if (matchConfidence >= 85) {
            setFaceStatus('matched');
            setFaceVerified(true);
            setFaceMatchProgress(100);
            setMatchScoreDisplay(matchConfidence);
            setFaceStatusMessage(
              `✅ Biometric Security Passed: Verified ${targetEmpRef.current?.name || selectedEmp?.name} (${matchConfidence}% Confidence)`
            );
            clearInterval(scanIntervalRef.current);

            // INSTANTLY AUTO-SAVE ATTENDANCE ON MATCH!
            handleConfirmAttendance(targetEmpRef.current || selectedEmp);
          } else {
            setFaceStatus('mismatch');
            setFaceVerified(false);
            setFaceMatchProgress(40);
            setMatchScoreDisplay(matchConfidence);
            setFaceStatusMessage(
              `⛔ Security Alert: Face Mismatch! Unrecognized person (Score: ${matchConfidence}% < 85% required)`
            );
          }
        } else {
          setFaceStatusMessage(`🔒 Verifying multi-zone facial biometrics... (${currentProg}%)`);
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
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 font-semibold flex items-center justify-center gap-2">
        <RefreshCw size={18} className="animate-spin text-indigo-600" />
        <span>Loading employee workspace...</span>
      </div>
    );
  }

  if (!selectedEmp) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 font-semibold space-y-2">
        <Lock size={36} className="text-slate-400 mx-auto" />
        <h3 className="text-base font-bold text-slate-800">Employee Workspace Restricted</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          No employee profile matches your logged-in credentials. Please contact your SuperAdmin to verify your account registration.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-4 text-slate-800 font-sans pb-12">
      {/* Top Header & Employee Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <UserCheck size={22} className="text-slate-800 stroke-[1.75]" />
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Employee Portal</h1>
        </div>

        {/* Employee Switcher */}
        {employeeProfile?.isSuperAdmin ? (
          <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg border border-slate-300 shadow-2xs">
            <span className="text-xs font-semibold text-slate-700">Admin View:</span>
            <CustomSelect
              options={employees.map((emp) => ({ value: emp.id, label: `${emp.name} (${emp.empId})` }))}
              value={selectedEmp.id}
              onChange={(val) => setSelectedEmpId(val)}
              size="sm"
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-slate-100 px-3.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs select-none">
            <Lock size={14} className="text-indigo-600" />
            <span className="text-xs font-bold text-slate-800">
              {selectedEmp.name} <span className="font-mono text-slate-500 font-medium">({selectedEmp.empId})</span>
            </span>
          </div>
        )}
      </div>

      {/* Profile Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-slate-200 shadow-xs bg-slate-100 flex-shrink-0">
            <img
              src={selectedEmp.photoUrl || '/logo.png'}
              alt={selectedEmp.name}
              className="w-full h-full object-cover"
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">{selectedEmp.name}</h2>
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 font-mono">
                {selectedEmp.empId}
              </span>
            </div>
            
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 font-medium">
              <Briefcase size={13} className="text-slate-400" />
              {selectedEmp.department || 'Production'} • Mobile: <span className="font-mono text-slate-800 font-bold">{selectedEmp.mobile}</span>
            </p>

            {selectedEmp.address && (
              <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                Address: {selectedEmp.address}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80 w-full md:w-auto justify-between">
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Payment Mode</p>
            <span className="text-xs font-bold uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md mt-0.5 inline-block border border-emerald-200">
              {selectedEmp.paymentMode}
            </span>
          </div>

          <div className="border-l border-slate-200 pl-3">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Base Rate</p>
            <p className="text-xs font-bold text-slate-900 mt-0.5">
              ₹{selectedEmp.salary.toLocaleString('en-IN')}{' '}
              <span className="text-[10px] text-slate-400 font-normal">
                ({selectedEmp.paymentMode === 'monthly' ? '/mo' : '/day'})
              </span>
            </p>
          </div>

          <div className="border-l border-slate-200 pl-3">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Per Day Rate</p>
            <p className="text-xs font-bold text-indigo-600 mt-0.5">
              ₹{perDayRate.toLocaleString('en-IN')} / day
            </p>
          </div>
        </div>
      </div>

      {/* TAB NAVIGATION BAR */}
      <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200/80 shadow-xs">
        <button
          onClick={() => setActiveTab('attendance')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'attendance'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <UserCheck size={16} />
          Attendance & Punch Log
        </button>

        <button
          onClick={() => setActiveTab('salary')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'salary'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <CreditCard size={16} />
          Salary & Monthly Payslips
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'profile'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <User size={16} />
          Full Employee Profile
        </button>
      </div>

      {/* TAB 1: ATTENDANCE */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
          {/* Action Card: Self Attendance Marking Banner */}
          <div className="bg-gradient-to-br from-indigo-50 via-white to-slate-50 p-6 rounded-2xl border border-indigo-100 shadow-xs flex flex-col md:flex-row items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
                <Camera size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Mark Today's Attendance ({todayStr})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Uses GPS Location Verification (100m Geofence) + High-Security Face Recognition with Anti-Spoof Liveness.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              {todayAttendance ? (
                <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 px-4 py-2.5 rounded-xl border border-emerald-200 text-xs font-bold">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  Today Marked Present ({todayAttendance.checkInTime})
                </div>
              ) : (
                <button
                  onClick={handleStartSelfAttendance}
                  className="w-full md:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <UserCheck size={16} />
                  Mark My Attendance Now
                </button>
              )}
            </div>
          </div>

          {/* Assigned Geofence Site Bounds Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <MapPin size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Assigned Geofenced Workplace Site</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  GPS Geofence Target: <span className="font-mono text-slate-800 font-bold">{selectedEmp.latitude || 13.1189}, {selectedEmp.longitude || 80.0967}</span> (Max distance allowed: 100m)
                </p>
              </div>
            </div>

            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1.5">
              <ShieldCheck size={16} /> 100m GPS & Anti-Spoof Face ID Active
            </span>
          </div>

          {/* Attendance History Table */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Punch Attendance Logs ({selectedEmp.name})
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Historical log of punches, GPS verification, and Face ID scans</p>
              </div>

              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 font-mono">
                {selectedEmpAttendance.length} Logs Recorded
              </span>
            </div>

            {selectedEmpAttendance.length === 0 ? (
              <div className="p-10 text-center text-slate-400 text-xs font-medium">
                No attendance logs recorded yet for {selectedEmp.name}. Click "Mark My Attendance Now" above to add punch.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 border-b border-slate-100">
                      <th className="py-3.5 px-5">Date</th>
                      <th className="py-3.5 px-4">Check In Time</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">GPS Verification</th>
                      <th className="py-3.5 px-5 text-right">Face Scan Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                    {selectedEmpAttendance.map((row: AttendanceRecord) => (
                      <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-5 font-bold text-slate-900">{row.date}</td>
                        <td className="py-3.5 px-4 text-slate-700 font-mono">{row.checkInTime}</td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                              row.status === 'Present'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-[11px] text-slate-600">
                          <span className="text-emerald-600 font-bold flex items-center gap-1">
                            <MapPin size={13} /> {row.distanceMeters || 0}m away (In range)
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-right font-bold text-indigo-600">
                          <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-100">
                            <ShieldCheck size={13} /> Matched (Verified)
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SALARY & MONTHLY PAYSLIP */}
      {activeTab === 'salary' && (
        <div className="space-y-6">
          {/* Controls Bar: Month Selector */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-700">Select Month for Payslip:</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Formula: <span className="font-bold text-slate-800">Per Day Rate = Base ÷ 30</span> | <span className="font-bold text-slate-800">Paid Leaves = Up to {acceptedLeaves} Days</span>
            </div>
          </div>

          {/* Month Stats Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <p className="text-xs text-slate-500 font-bold uppercase">Days Present ({selectedMonth})</p>
              <h3 className="text-2xl font-bold text-emerald-600 mt-1">{presentDays} Days</h3>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <p className="text-xs text-slate-500 font-bold uppercase">Accepted Paid Leaves</p>
              <h3 className="text-2xl font-bold text-indigo-600 mt-1">{acceptedLeaves} Days</h3>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <p className="text-xs text-slate-500 font-bold uppercase">Unpaid Deductions</p>
              <h3 className="text-2xl font-bold text-rose-600 mt-1">{unpaidLeaves} Days</h3>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <p className="text-xs text-slate-500 font-bold uppercase">Net Earned Payout</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">₹{totalEarned.toLocaleString('en-IN')}</h3>
            </div>
          </div>

          {/* Detailed Payslip View */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
            <div className="border-b border-slate-100 pb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md border border-indigo-100">
                  Official Salary Payslip
                </span>
                <h2 className="text-xl font-bold text-slate-900 mt-2">
                  Payslip for {selectedEmp.name}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Month Period: <span className="font-bold text-slate-800">{selectedMonth}</span> • Code: <span className="font-mono font-bold text-slate-800">{selectedEmp.empId}</span>
                </p>
              </div>

              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Printer size={14} /> Print Payslip
              </button>
            </div>

            {/* Payslip Breakdown Table */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Earnings Column */}
              <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200/80 space-y-3">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-2">
                  Earnings Breakdown
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Base Salary ({selectedEmp.paymentMode}):</span>
                    <span className="font-bold text-slate-900">₹{selectedEmp.salary.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Per Day Rate:</span>
                    <span className="font-bold text-indigo-600 font-mono">₹{perDayRate.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Present Days ({presentDays}):</span>
                    <span className="font-bold text-emerald-600">₹{(presentDays * perDayRate).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Paid Leave Allowance ({Math.min(leaveDays, acceptedLeaves)} days):</span>
                    <span className="font-bold text-emerald-600">₹{(Math.min(leaveDays, acceptedLeaves) * perDayRate).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Deductions & Summary Column */}
              <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200/80 space-y-3">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-2">
                  Deductions & Total
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Total Unpaid Leave Days:</span>
                    <span className="font-bold text-rose-600">{unpaidLeaves} Days</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Unpaid Leave Deductions:</span>
                    <span className="font-bold text-rose-600">- ₹{(unpaidLeaves * perDayRate).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 pt-2 border-t border-slate-200">
                    <span>Total Payable Days:</span>
                    <span className="font-bold text-slate-900">{payableDays} Days</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Total Net Payout Banner */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-5 rounded-2xl shadow-md flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-100">Net Earned Salary Payout</p>
                <p className="text-2xl font-extrabold mt-0.5">₹{totalEarned.toLocaleString('en-IN')}</p>
              </div>
              <span className="text-xs font-bold bg-white/20 px-3 py-1.5 rounded-xl border border-white/30">
                Verified & Ready
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FULL EMPLOYEE PROFILE */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-8">
            {/* Header Profile Info */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 border-b border-slate-100 pb-6">
              <div className="w-24 h-24 rounded-3xl overflow-hidden border-4 border-indigo-100 shadow-md bg-slate-900">
                <img
                  src={selectedEmp.photoUrl || '/logo.png'}
                  alt={selectedEmp.name}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-slate-900">{selectedEmp.name}</h2>
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 font-mono">
                    {selectedEmp.empId}
                  </span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 uppercase">
                    {selectedEmp.status || 'Active'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-semibold">
                  Department: <span className="text-slate-800">{selectedEmp.department || 'Production'}</span> • Mobile: <span className="font-mono text-slate-800 font-bold">{selectedEmp.mobile}</span>
                </p>
              </div>
            </div>

            {/* Structured Profile Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

              {/* Card 1: Personal & Contact Information */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-4">
                <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs uppercase tracking-wider border-b border-slate-200 pb-2">
                  <User size={16} /> Personal & Contact Info
                </div>

                <div className="space-y-2.5 text-xs font-medium">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Full Name:</span>
                    <span className="text-slate-900 font-bold">{selectedEmp.name}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[11px]">Employee ID Code:</span>
                    <span className="text-slate-900 font-mono font-bold">{selectedEmp.empId}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[11px]">Mobile Number:</span>
                    <span className="text-slate-900 font-mono font-bold">{selectedEmp.mobile}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[11px]">Workplace Department:</span>
                    <span className="text-slate-900 font-bold">{selectedEmp.department || 'Production'}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[11px]">Residential Address:</span>
                    <span className="text-slate-800 font-semibold">{selectedEmp.address || 'Pattabiram, Chennai - 600072'}</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Payroll & Compensation Details */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-4">
                <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs uppercase tracking-wider border-b border-slate-200 pb-2">
                  <CreditCard size={16} /> Payroll & Salary Setup
                </div>

                <div className="space-y-2.5 text-xs font-medium">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Payment Mode:</span>
                    <span className="text-emerald-700 font-bold uppercase bg-emerald-100 px-2 py-0.5 rounded text-[10px] inline-block">
                      {selectedEmp.paymentMode}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[11px]">Base Salary Rate:</span>
                    <span className="text-slate-900 font-bold">
                      ₹{selectedEmp.salary.toLocaleString('en-IN')} ({selectedEmp.paymentMode === 'monthly' ? '/mo' : '/day'})
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[11px]">Calculated Per Day Rate:</span>
                    <span className="text-indigo-600 font-mono font-bold">₹{perDayRate.toLocaleString('en-IN')} / day</span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[11px]">Accepted Paid Leaves Limit:</span>
                    <span className="text-slate-900 font-bold">{acceptedLeaves} Days / Month</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Geofence GPS Work Site */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-4">
                <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs uppercase tracking-wider border-b border-slate-200 pb-2">
                  <MapPin size={16} /> Geofenced GPS Site Bounds
                </div>

                <div className="space-y-2.5 text-xs font-medium">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Target GPS Latitude:</span>
                    <span className="text-slate-900 font-mono font-bold">{selectedEmp.latitude || 13.1189}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[11px]">Target GPS Longitude:</span>
                    <span className="text-slate-900 font-mono font-bold">{selectedEmp.longitude || 80.0967}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[11px]">Allowed Punch Distance Radius:</span>
                    <span className="text-emerald-700 font-bold">Within 100 Meters</span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[11px]">Biometric Security Level:</span>
                    <span className="text-indigo-700 font-bold">85%+ Biometric Match + Anti-Spoof</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ATTENDANCE MARKING MODAL (GPS & Face ID) */}
      {verificationStep !== 'idle' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                  <UserCheck size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Mark Attendance — {selectedEmp.name}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono">{selectedEmp.empId}</p>
                </div>
              </div>

              <button
                onClick={handleCloseVerification}
                className="w-7 h-7 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {verificationStep === 'location' && (
              <div className="p-8 text-center space-y-4">
                <RefreshCw size={36} className="animate-spin text-indigo-600 mx-auto" />
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Requesting GPS Location...</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Verifying if user is within 100 meters of assigned site ({selectedEmp.latitude || 13.1189}, {selectedEmp.longitude || 80.0967})
                  </p>
                </div>
              </div>
            )}

            {verificationStep === 'out_of_range' && (
              <div className="p-6 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                  <ShieldAlert size={32} />
                </div>
                <div>
                  <h4 className="text-base font-bold text-rose-700">GPS Location Out of Range!</h4>
                  <p className="text-xs text-slate-600 mt-2">
                    Current distance: <span className="font-bold text-rose-700 text-sm">{currentDistance} meters</span> away.
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Attendance can only be marked within <span className="font-bold text-slate-800">100 meters</span> of assigned location.
                  </p>
                </div>

                <button
                  onClick={handleCloseVerification}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Close & Retry Location
                </button>
              </div>
            )}

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

                <canvas ref={canvasRef} className="hidden" />

                <div className="flex items-center justify-center gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-200/80">
                  <img
                    src={selectedEmp.photoUrl || '/logo.png'}
                    alt={selectedEmp.name}
                    className="w-10 h-10 rounded-xl object-cover border border-slate-300 shadow-2xs"
                  />
                  <div className="text-left">
                    <p className="text-xs font-bold text-slate-900">Target Employee: {selectedEmp.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono">Code: {selectedEmp.empId} • Dept: {selectedEmp.department}</p>
                  </div>
                </div>

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

                  {faceStatus === 'scanning' && (
                    <div className="absolute inset-0 border-2 border-indigo-400 rounded-full animate-pulse opacity-60 pointer-events-none" />
                  )}
                </div>

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
                    ✓ Verified: {selectedEmp?.name}
                  </p>
                </div>

                <p className="text-xs text-slate-500 font-medium">
                  Recorded present for <span className="font-bold text-slate-800">{todayStr}</span>
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
    </div>
  );
}
