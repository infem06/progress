
import React, { useState, useEffect } from 'react';
import { 
  Users, PlusCircle, FileText, Search, Calendar, ChevronRight, Activity, Home,
  UserPlus, ArrowLeft, Loader2, Edit3, LogOut, Sparkles,
  CalendarDays, ChevronDown, ChevronUp, Download, Upload, ShieldCheck, Settings, ExternalLink
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";

// --- 유형 정의 (Internal Types) ---
enum Diagnosis {
  ASD = '자폐스펙트럼',
  ADHD = '주의력결핍 과잉행동장애',
  ID = '지적장애',
  CP = '뇌병변',
  DD = '발달지연',
  PHYSICAL = '지체장애',
  LANGUAGE = '언어장애',
  VISUAL = '시각장애',
  OTHER = '기타'
}

enum DisabilitySeverity {
  SEVERE = '심한 장애',
  NOT_SEVERE = '심하지 않은 장애'
}

enum Gender {
  MALE = '남',
  FEMALE = '여'
}

interface User {
  id: string;
  name: string;
  password: string;
}

interface SuspensionRange {
  start: string;
  end: string;
}

interface Patient {
  id: string;
  name: string;
  gender: Gender;
  birthDate: string;
  diagnosis: Diagnosis;
  disabilitySeverity: DisabilitySeverity;
  goals: string[];
  initialAssessment: string; 
  initialAssessmentDate: string;
  interimAssessment: string; 
  interimAssessmentDate: string;
  finalAssessment: string;   
  finalAssessmentDate: string;
  therapyStartDate: string;
  suspensions: SuspensionRange[];
  terminationDate?: string;
}

interface TherapyLog {
  id: string;
  patientId: string;
  date: string;
  activityName: string;
  generatedLog: string;
  reaction: string;
  createdAt: number;
}

// --- 메인 앱 컴포넌트 ---
export default function App() {
  const [user, setUser] = useState<User>(() => {
    const saved = localStorage.getItem('ot_user_profile');
    return saved ? JSON.parse(saved) : { id: 'user_1', name: '김주영', password: '1197' };
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => localStorage.getItem('ot_auth_session') === 'true');
  const [patients, setPatients] = useState<Patient[]>(() => {
    try {
      const saved = localStorage.getItem('ot_patients_data');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });
  const [logs, setLogs] = useState<TherapyLog[]>(() => {
    try {
      const saved = localStorage.getItem('ot_logs_data');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [view, setView] = useState<'dashboard' | 'patients' | 'add_patient' | 'patient_detail' | 'generate_log' | 'data_management' | 'settings'>('dashboard');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditingPatient, setIsEditingPatient] = useState(false);
  const [editForm, setEditForm] = useState<Patient | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedAssessments, setExpandedAssessments] = useState<{ [key: string]: boolean }>({});
  const [isAiReady, setIsAiReady] = useState(false);

  // FIX: Added derived state for 'selectedPatient' to resolve missing name errors
  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  // FIX: Added 'toggleAssessment' helper function to resolve missing function error
  const toggleAssessment = (key: string) => {
    setExpandedAssessments(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // FIX: Added 'handleDeleteLog' helper function to resolve missing function error
  const handleDeleteLog = (id: string) => {
    if (deleteConfirmId === id) {
      setLogs(prev => prev.filter(l => l.id !== id));
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(id);
    }
  };

  useEffect(() => {
    localStorage.setItem('ot_user_profile', JSON.stringify(user));
    localStorage.setItem('ot_patients_data', JSON.stringify(patients));
    localStorage.setItem('ot_logs_data', JSON.stringify(logs));
  }, [user, patients, logs]);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setIsAiReady(hasKey || !!process.env.API_KEY);
      } else {
        setIsAiReady(!!process.env.API_KEY);
      }
    };
    checkKey();
  }, []);

  const handleOpenApiKeyDialog = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      await window.aistudio.openSelectKey();
      setIsAiReady(true); // Race condition 방지: 즉시 true로 가정
    } else {
      alert("이 환경에서는 보안 키 선택 도구를 사용할 수 없습니다. 관리자에게 문의하세요.");
    }
  };

  const generateFiveDayLogsInternal = async (patient: Patient, activityInput: string, startDate: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = "gemini-3-flash-preview";
    
    const prompt = `당신은 16년차 작업치료사입니다. [${patient.name}]의 일지를 5일치 작성하세요.
    진단: ${patient.diagnosis}
    목표: ${patient.goals.join(", ")}
    활동: ${activityInput}
    기준일: ${startDate}
    
    [양식]
    *제목
    1.
    2.
    3.
    4.
    5.
    
    *상담내용
    - 
    전문적인 개조식으로 작성하세요.`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { 
        temperature: 0.7,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            logs: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING },
                  activityName: { type: Type.STRING },
                  content: { type: Type.STRING }
                },
                required: ["date", "activityName", "content"]
              }
            }
          },
          required: ["logs"]
        }
      }
    });
    return JSON.parse(response.text).logs;
  };

  const handleGenerateBatchLogs = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedPatient) return;
    if (!isAiReady) {
      alert("AI 키가 설정되지 않았습니다. 설정 메뉴에서 키를 연결해주세요.");
      setView('settings');
      return;
    }

    setIsGenerating(true);
    const formData = new FormData(e.currentTarget);
    const activityInput = formData.get('activity') as string;
    const startDate = formData.get('date') as string;

    try {
      const generatedLogs = await generateFiveDayLogsInternal(selectedPatient, activityInput, startDate);
      const newLogs: TherapyLog[] = generatedLogs.map((log: any, idx: number) => ({
        id: (Date.now() + idx).toString(),
        patientId: selectedPatient.id,
        date: log.date,
        activityName: log.activityName,
        generatedLog: log.content,
        reaction: "",
        createdAt: Date.now() + idx
      }));
      setLogs(prev => [...newLogs, ...prev]);
      setView('patient_detail');
    } catch (error: any) {
      if (error.message?.includes("entity was not found")) {
        alert("API 키가 올바르지 않거나 만료되었습니다. 다시 설정해주세요.");
        setIsAiReady(false);
        setView('settings');
      } else {
        alert("일지 생성 중 오류가 발생했습니다.");
      }
    } finally { setIsGenerating(false); }
  };

  // --- 기존 핸들러들 ---
  const handleLogin = (e: React.FormEvent) => { e.preventDefault(); setIsAuthenticated(true); localStorage.setItem('ot_auth_session', 'true'); setView('dashboard'); };
  const handleLogout = () => { setIsAuthenticated(false); localStorage.removeItem('ot_auth_session'); setView('dashboard'); };
  const handleAddPatient = (e: React.FormEvent) => {
    e.preventDefault();
    const newPatient: Patient = { id: Date.now().toString(), ...newPatientForm, goals: newPatientForm.goals.split(',').map(g => g.trim()).filter(g => g !== ''), };
    setPatients(prev => [...prev, newPatient]);
    setView('patients');
  };
  const [newPatientForm, setNewPatientForm] = useState({ name: '', gender: Gender.MALE, birthDate: '', diagnosis: Diagnosis.ASD, disabilitySeverity: DisabilitySeverity.SEVERE, goals: '', initialAssessment: '', initialAssessmentDate: new Date().toISOString().split('T')[0], interimAssessment: '', interimAssessmentDate: '', finalAssessment: '', finalAssessmentDate: '', therapyStartDate: new Date().toISOString().split('T')[0], suspensions: [], terminationDate: '' });

  if (!isAuthenticated) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-10 border border-slate-100">
        <div className="flex flex-col items-center mb-10">
          <Activity className="w-16 h-16 text-emerald-500 mb-4" />
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">OT-Log Master</h1>
        </div>
        <form onSubmit={handleLogin} className="space-y-6">
          <input placeholder="아이디" required className="w-full p-5 bg-slate-50 border-none rounded-2xl outline-none font-bold shadow-inner" />
          <input type="password" placeholder="비밀번호" required className="w-full p-5 bg-slate-50 border-none rounded-2xl outline-none font-bold shadow-inner" />
          <button type="submit" className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-xl shadow-xl shadow-emerald-100 transition-all active:scale-95">입장하기</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans">
      <nav className="w-full md:w-72 bg-slate-900 text-white p-6 md:p-8 sticky top-0 z-20 flex flex-col md:h-screen">
        <div className="flex flex-row md:flex-col items-center md:items-start justify-between md:justify-start">
          <div className="flex items-center gap-3 mb-0 md:mb-12">
            <Activity className="w-6 h-6 text-emerald-500" />
            <h1 className="text-xl font-black tracking-tighter">OT Master</h1>
          </div>
          <ul className="hidden md:block space-y-3 w-full">
            <NavItem active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={<Home/>} label="대시보드" />
            <NavItem active={view === 'patients' || view === 'patient_detail'} onClick={() => setView('patients')} icon={<Users/>} label="이용자 차트" />
            <NavItem active={view === 'add_patient'} onClick={() => setView('add_patient')} icon={<UserPlus/>} label="신규 등록" />
            <NavItem active={view === 'data_management'} onClick={() => setView('data_management')} icon={<ShieldCheck/>} label="데이터 백업" />
            <NavItem active={view === 'settings'} onClick={() => setView('settings')} icon={<Settings/>} label="시스템 설정" />
          </ul>
        </div>
        
        <div className="mt-auto hidden md:flex flex-col gap-4">
          <div className="p-5 bg-slate-800/50 rounded-2xl border border-slate-700/50">
             <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">AI Status</span>
                <div className={`w-2 h-2 rounded-full ${isAiReady ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-red-500'}`}></div>
             </div>
             <p className="text-sm font-bold truncate">{user.name} 치료사</p>
             <p className="text-[10px] text-slate-500 mt-1">{isAiReady ? 'AI 엔진 가동 중' : 'AI 설정 필요'}</p>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-red-400 font-bold text-sm transition-all"><LogOut className="w-5 h-5" /> 로그아웃</button>
        </div>
      </nav>

      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
        {view === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in">
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">{user.name} 선생님, 반가워요!</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <DashboardCard icon={<Users className="text-blue-600"/>} title="관리 이용자" value={`${patients.length}명`} color="bg-blue-50" />
              <DashboardCard icon={<FileText className="text-emerald-600"/>} title="누적 일지" value={`${logs.length}건`} color="bg-emerald-50" />
              <DashboardCard icon={<ShieldCheck className="text-purple-600"/>} title="보호 상태" value="안전함" color="bg-purple-50" />
            </div>
            {!isAiReady && (
              <div className="p-6 bg-amber-50 border border-amber-200 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="bg-white p-3 rounded-2xl shadow-sm text-amber-500"><Sparkles/></div>
                  <div>
                    <p className="font-black text-slate-800">AI 일지 기능을 사용하시겠습니까?</p>
                    <p className="text-sm text-slate-500 font-medium">Gemini API 키를 연결하면 5일치 일지 자동 생성이 가능합니다.</p>
                  </div>
                </div>
                <button onClick={() => setView('settings')} className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-sm shadow-xl">설정하러 가기</button>
              </div>
            )}
          </div>
        )}

        {view === 'settings' && (
          <div className="max-w-3xl mx-auto space-y-8 animate-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-black text-slate-800">시스템 설정</h2>
              <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${isAiReady ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                {isAiReady ? 'AI Engine Active' : 'AI Engine Inactive'}
              </div>
            </div>
            
            <section className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-100 space-y-8">
              <div className="space-y-2">
                <h3 className="text-xl font-black flex items-center gap-3 text-slate-800">
                  <Sparkles className="text-emerald-500"/> AI 보안 API 키 관리
                </h3>
                <p className="text-sm text-slate-500 font-medium leading-relaxed">
                  치료 일지 자동 생성을 위해 Google Gemini API 키가 필요합니다. 보안을 위해 브라우저의 전용 선택 창을 통해 키를 연결합니다.
                </p>
              </div>

              <div className="p-6 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div>
                    <p className="font-black text-slate-700">보안 키 선택</p>
                    <p className="text-xs text-slate-400 mt-1 font-bold italic">입력 시 패스워드 형식(*)으로 보호됩니다.</p>
                  </div>
                  <button onClick={handleOpenApiKeyDialog} className="w-full sm:w-auto px-10 py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all">
                    {isAiReady ? 'API 키 다시 설정' : 'API 키 연결하기'}
                  </button>
                </div>
              </div>

              <div className="pt-6 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <p className="text-xs font-bold text-slate-400">도움이 필요하신가요?</p>
                <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-500 font-black text-xs hover:underline uppercase tracking-wider">
                  Gemini API 요금제 및 결제 안내 <ExternalLink className="w-3 h-3"/>
                </a>
              </div>
            </section>
          </div>
        )}

        {/* --- 나머지 뷰들은 기존과 동일 (생략된 로직 유지) --- */}
        {view === 'patients' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h2 className="text-3xl font-black text-slate-800">이용자 차트</h2>
              <div className="relative w-full md:w-80">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input type="text" placeholder="검색..." className="pl-12 pr-6 py-3 bg-white shadow-sm rounded-xl w-full font-bold outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {patients.filter(p => p.name.includes(searchTerm)).map(patient => (
                <div key={patient.id} className="bg-white p-8 rounded-[2rem] border border-slate-100 hover:shadow-xl cursor-pointer transition-all" onClick={() => { setSelectedPatientId(patient.id); setView('patient_detail'); }}>
                  <h4 className="text-2xl font-black text-slate-800 mb-1">{patient.name} <span className="text-sm text-slate-300 font-bold">{patient.gender}</span></h4>
                  <p className="text-xs text-slate-400 font-black uppercase tracking-widest mb-6">{patient.diagnosis}</p>
                  <div className="flex justify-between text-[11px] font-black uppercase"><span className="text-slate-400">치료 개시일</span><span className="text-slate-700">{patient.therapyStartDate}</span></div>
                </div>
              ))}
              <div onClick={() => setView('add_patient')} className="border-4 border-dashed border-slate-200 p-8 rounded-[2rem] flex flex-col items-center justify-center text-slate-300 hover:text-emerald-500 hover:border-emerald-500 cursor-pointer min-h-[160px] transition-all">
                <PlusCircle className="w-10 h-10 mb-2" />
                <p className="font-black text-sm uppercase">신규 이용자 등록</p>
              </div>
            </div>
          </div>
        )}

        {view === 'generate_log' && selectedPatient && (
          <div className="max-w-3xl mx-auto animate-in slide-in-from-bottom-8">
            <button onClick={() => setView('patient_detail')} className="mb-8 flex items-center gap-2 text-slate-400 hover:text-emerald-600 font-black text-xs uppercase tracking-widest"><ArrowLeft className="w-4 h-4" /> 뒤로가기</button>
            <div className="bg-white p-10 md:p-16 rounded-[3rem] shadow-2xl border relative overflow-hidden">
              <div className="absolute top-0 left-0 w-3 h-full bg-emerald-500"></div>
              <h2 className="text-3xl font-black mb-3 text-slate-800 tracking-tighter">AI 치료일지 생성</h2>
              <p className="text-slate-400 mb-10 font-bold text-xs uppercase tracking-widest leading-relaxed">베테랑 치료사의 관점으로 5일치 일지를 구성합니다.</p>
              <form onSubmit={handleGenerateBatchLogs} className="space-y-8">
                <div className="flex flex-col gap-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase ml-1">치료 시작일</label>
                   <input name="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="p-5 bg-slate-50 border-none rounded-2xl font-bold shadow-inner outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">주요 활동 (키워드)</label>
                  <textarea name="activity" rows={4} className="w-full p-6 bg-slate-50 border-none rounded-2xl outline-none font-bold text-slate-700 shadow-inner focus:ring-2 focus:ring-emerald-500" placeholder="예: 시지각 협응, 대근육 활동 등"></textarea>
                </div>
                <button type="submit" disabled={isGenerating} className={`w-full py-6 rounded-2xl font-black text-2xl shadow-2xl flex items-center justify-center gap-4 transition-all ${isGenerating ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98]'}`}>
                  {isGenerating ? <><Loader2 className="w-8 h-8 animate-spin" /> 생성 중...</> : <><Sparkles className="w-8 h-8"/> 일지 일괄 생성</>}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* --- 기타 뷰는 기존과 동일하게 유지 --- */}
        {view === 'patient_detail' && selectedPatient && (
          <div className="space-y-8 animate-in slide-in-from-right-4">
             <button onClick={() => setView('patients')} className="flex items-center gap-2 text-slate-400 hover:text-emerald-600 font-black text-xs uppercase tracking-widest"><ArrowLeft className="w-4 h-4" /> 차트 목록</button>
             <div className="bg-white rounded-[2.5rem] shadow-xl border p-10 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-3 h-full bg-emerald-500"></div>
                <h2 className="text-5xl font-black text-slate-800 mb-8 tracking-tighter">{selectedPatient.name}</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                   <AssessmentBox title="초기 평가" date={selectedPatient.initialAssessmentDate} content={selectedPatient.initialAssessment} isExpanded={expandedAssessments['initial']} onToggle={() => toggleAssessment('initial')} theme="emerald" />
                   <AssessmentBox title="중간 평가" date={selectedPatient.interimAssessmentDate} content={selectedPatient.interimAssessment} isExpanded={expandedAssessments['interim']} onToggle={() => toggleAssessment('interim')} theme="blue" />
                   <AssessmentBox title="종결 평가" date={selectedPatient.finalAssessmentDate} content={selectedPatient.finalAssessment} isExpanded={expandedAssessments['final']} onToggle={() => toggleAssessment('final')} theme="purple" />
                </div>
                <div className="flex justify-end">
                   <button onClick={() => setView('generate_log')} className="px-10 py-5 bg-emerald-600 text-white rounded-2xl font-black text-lg flex items-center gap-3 shadow-2xl hover:bg-emerald-700 transition-all">
                      <Sparkles className="w-6 h-6" /> AI 일지 자동 생성
                   </button>
                </div>
             </div>
             <div className="space-y-6">
                <h3 className="text-xl font-black text-slate-800 px-2">수행 일지 목록</h3>
                {logs.filter(l => l.patientId === selectedPatient.id).map(log => (
                   <div key={log.id} className="bg-white rounded-3xl shadow-sm border p-8 space-y-4">
                      <div className="flex justify-between items-center text-sm font-black text-slate-400 uppercase tracking-widest">
                         <span>{log.date} | {log.activityName}</span>
                         <button onClick={() => handleDeleteLog(log.id)} className="text-slate-300 hover:text-red-500">{deleteConfirmId === log.id ? '정말 삭제할까요?' : '삭제'}</button>
                      </div>
                      <p className="text-slate-700 font-bold leading-relaxed whitespace-pre-wrap border-l-4 border-emerald-500 pl-6">{log.generatedLog}</p>
                   </div>
                ))}
             </div>
          </div>
        )}
      </main>
    </div>
  );
}

// --- 공통 컴포넌트 ---
function NavItem({ active, onClick, icon, label }: any) {
  return (
    <li>
      <button onClick={onClick} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all group ${active ? 'bg-emerald-600 text-white shadow-xl translate-x-1' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}>
        {React.cloneElement(icon as React.ReactElement, { className: "w-5 h-5" })}
        <span className="font-black text-[11px] uppercase tracking-widest">{label}</span>
      </button>
    </li>
  );
}

function MobileNavItem({ active, onClick, icon }: any) {
  return (
    <button onClick={onClick} className={`flex-shrink-0 p-3 rounded-xl transition-all ${active ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400'}`}>
      {React.cloneElement(icon as React.ReactElement, { className: "w-5 h-5" })}
    </button>
  );
}

function DashboardCard({ icon, title, value, color }: any) {
  return (
    <div className={`${color} p-8 rounded-[2rem] border border-white shadow-sm flex items-center gap-8 group transition-all hover:scale-[1.02]`}>
      <div className="bg-white p-5 rounded-2xl shadow-lg group-hover:rotate-6 transition-transform">
        {React.cloneElement(icon as React.ReactElement, { className: "w-8 h-8" })}
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
        <p className="text-3xl font-black text-slate-800 tracking-tighter">{value}</p>
      </div>
    </div>
  );
}

function AssessmentBox({ title, date, content, isExpanded, onToggle, theme }: any) {
  const bgMap: any = { emerald: 'bg-emerald-50/50 border-emerald-100', blue: 'bg-blue-50/50 border-blue-100', purple: 'bg-purple-50/50 border-purple-100' };
  const textMap: any = { emerald: 'text-emerald-600', blue: 'text-blue-600', purple: 'text-purple-600' };

  return (
    <div className={`${bgMap[theme]} p-6 rounded-[2rem] border relative flex flex-col min-h-[140px] shadow-sm`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className={`text-[10px] font-black ${textMap[theme]} uppercase tracking-widest`}>{title}</p>
          <p className="text-[10px] font-black text-slate-400">{date || '미입력'}</p>
        </div>
        <button onClick={onToggle} className="text-[10px] bg-white border px-3 py-1 rounded-full font-black text-slate-500 hover:bg-slate-50 transition-all">
          {isExpanded ? <><ChevronUp className="w-3 h-3 inline"/> 접기</> : <><ChevronDown className="w-3 h-3 inline"/> 보기</>}
        </button>
      </div>
      <div className={`text-xs text-slate-600 leading-relaxed font-bold whitespace-pre-wrap transition-all overflow-hidden ${isExpanded ? 'max-h-[1000px]' : 'max-h-[60px] line-clamp-2'}`}>
        {content || "기록된 내용이 없습니다."}
      </div>
    </div>
  );
}

function InfoItem({ icon, label, value, color = "text-slate-800" }: any) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
        {React.cloneElement(icon as React.ReactElement, { className: "w-3 h-3" })} {label}
      </p>
      <div className={`text-xs md:text-sm font-black tracking-tight ${color} truncate`}>{value}</div>
    </div>
  );
}
