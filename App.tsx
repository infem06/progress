
import React, { useState, useEffect } from 'react';
import { 
  Users, PlusCircle, FileText, Search, Calendar, ChevronRight, Activity, Home,
  UserPlus, ArrowLeft, Loader2, Trash2, Edit3, LogOut, Sparkles,
  CalendarDays, ChevronDown, ChevronUp, Download, Upload, ShieldCheck
} from 'lucide-react';
import { Patient, Diagnosis, DisabilitySeverity, Gender, TherapyLog, User, SuspensionRange } from './types.ts';
import { generateFiveDayLogs } from './services/geminiService.ts';

export default function App() {
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
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

  const [view, setView] = useState<'dashboard' | 'patients' | 'add_patient' | 'patient_detail' | 'generate_log' | 'data_management'>('dashboard');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditingPatient, setIsEditingPatient] = useState(false);
  const [editForm, setEditForm] = useState<Patient | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedAssessments, setExpandedAssessments] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    setSaveStatus('saving');
    const timer = setTimeout(() => {
      localStorage.setItem('ot_user_profile', JSON.stringify(user));
      localStorage.setItem('ot_patients_data', JSON.stringify(patients));
      localStorage.setItem('ot_logs_data', JSON.stringify(logs));
      setSaveStatus('saved');
    }, 500);
    return () => clearTimeout(timer);
  }, [user, patients, logs]);

  const toggleAssessment = (type: string) => {
    setExpandedAssessments(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const [newPatientForm, setNewPatientForm] = useState({
    name: '', gender: Gender.MALE, birthDate: '', diagnosis: Diagnosis.ASD,
    disabilitySeverity: DisabilitySeverity.SEVERE, goals: '',
    initialAssessment: '', initialAssessmentDate: new Date().toISOString().split('T')[0],
    interimAssessment: '', interimAssessmentDate: '',
    finalAssessment: '', finalAssessmentDate: '',
    therapyStartDate: new Date().toISOString().split('T')[0],
    suspensions: [] as SuspensionRange[], terminationDate: ''
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticated(true);
    localStorage.setItem('ot_auth_session', 'true');
    setView('dashboard');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('ot_auth_session');
    setView('dashboard');
  };

  const handleAddPatient = (e: React.FormEvent) => {
    e.preventDefault();
    const newPatient: Patient = {
      id: Date.now().toString(),
      ...newPatientForm,
      goals: newPatientForm.goals.split(',').map(g => g.trim()).filter(g => g !== ''),
    };
    setPatients(prev => [...prev, newPatient]);
    setNewPatientForm({
      name: '', gender: Gender.MALE, birthDate: '', diagnosis: Diagnosis.ASD,
      disabilitySeverity: DisabilitySeverity.SEVERE, goals: '',
      initialAssessment: '', initialAssessmentDate: new Date().toISOString().split('T')[0],
      interimAssessment: '', interimAssessmentDate: '',
      finalAssessment: '', finalAssessmentDate: '',
      therapyStartDate: new Date().toISOString().split('T')[0],
      suspensions: [], terminationDate: ''
    });
    setView('patients');
  };

  const handleUpdatePatient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm) return;
    setPatients(prev => prev.map(p => p.id === editForm.id ? editForm : p));
    setIsEditingPatient(false);
  };

  const handleDeleteLog = (id: string) => {
    if (deleteConfirmId === id) {
      setLogs(prev => prev.filter(l => l.id !== id));
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(id);
      setTimeout(() => setDeleteConfirmId(null), 4000);
    }
  };

  const handleGenerateBatchLogs = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const selectedPatient = patients.find(p => p.id === selectedPatientId);
    if (!selectedPatient) return;
    setIsGenerating(true);
    const formData = new FormData(e.currentTarget);
    const activityInput = formData.get('activity') as string;
    const startDate = formData.get('date') as string;
    try {
      const generatedLogs = await generateFiveDayLogs(selectedPatient, activityInput, startDate);
      const newLogs: TherapyLog[] = generatedLogs.map((log, idx) => ({
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
    } catch (error) {
      alert("일지 생성 실패. API 키 또는 네트워크를 확인하세요.");
    } finally { setIsGenerating(false); }
  };

  const handleExportData = () => {
    const data = { patients, logs, user };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OT_Log_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (imported.patients && imported.logs) {
          if (confirm("데이터를 복구할까요? 기존 데이터는 삭제됩니다.")) {
            setPatients(imported.patients);
            setLogs(imported.logs);
            if (imported.user) setUser(imported.user);
          }
        }
      } catch (err) { alert("잘못된 형식의 파일입니다."); }
    };
    reader.readAsText(file);
  };

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  if (!isAuthenticated) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-2xl p-6 md:p-10 border border-slate-100">
        <div className="flex flex-col items-center mb-8 md:mb-10">
          <Activity className="w-10 h-10 md:w-14 md:h-14 text-emerald-500 mb-4 animate-pulse" />
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight text-center">OT-Log Master</h1>
        </div>
        <form onSubmit={handleLogin} className="space-y-4 md:space-y-6">
          <input placeholder="아이디" required className="w-full p-4 bg-slate-50 border-none rounded-xl md:rounded-2xl outline-none font-bold" />
          <input type="password" placeholder="비밀번호" required className="w-full p-4 bg-slate-50 border-none rounded-xl md:rounded-2xl outline-none font-bold" />
          <button type="submit" className="w-full py-4 md:py-5 bg-emerald-600 text-white rounded-xl md:rounded-2xl font-black text-lg shadow-xl shadow-emerald-100">입장하기</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans">
      <nav className="w-full md:w-72 bg-slate-900 text-white p-4 md:p-8 sticky top-0 z-20 flex flex-col md:h-screen md:justify-between">
        <div className="flex flex-row md:flex-col items-center md:items-start justify-between md:justify-start">
          <div className="flex items-center gap-3 mb-0 md:mb-12">
            <div className="bg-emerald-500 p-1.5 md:p-2 rounded-lg md:rounded-xl">
              <Activity className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <h1 className="text-lg md:text-xl font-black tracking-tighter">OT-Log Master</h1>
          </div>
          <ul className="hidden md:block space-y-3 w-full">
            <NavItem active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={<Home/>} label="대시보드" />
            <NavItem active={view === 'patients'} onClick={() => setView('patients')} icon={<Users/>} label="이용자 차트" />
            <NavItem active={view === 'add_patient'} onClick={() => setView('add_patient')} icon={<UserPlus/>} label="신규 등록" />
            <NavItem active={view === 'data_management'} onClick={() => setView('data_management')} icon={<ShieldCheck/>} label="데이터 관리" />
          </ul>
        </div>
        <div className="md:hidden flex gap-2 overflow-x-auto mt-4 pb-1">
          <MobileNavItem active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={<Home/>} />
          <MobileNavItem active={view === 'patients'} onClick={() => setView('patients')} icon={<Users/>} />
          <MobileNavItem active={view === 'add_patient'} onClick={() => setView('add_patient')} icon={<UserPlus/>} />
          <MobileNavItem active={view === 'data_management'} onClick={() => setView('data_management')} icon={<ShieldCheck/>} />
        </div>
        <div className="hidden md:flex flex-col mt-auto space-y-6">
          <div className="p-5 bg-slate-800/50 rounded-2xl border border-slate-700">
             <div className="flex items-center justify-between mb-2"><p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Status</p><ShieldCheck className="w-3 h-3 text-emerald-400" /></div>
             <p className="text-sm font-bold">{user.name} 치료사</p>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-4 px-4 py-4 rounded-xl text-slate-400 hover:text-red-400 font-bold text-sm"><LogOut className="w-5 h-5" /><span>로그아웃</span></button>
        </div>
      </nav>

      <main className="flex-1 p-4 md:p-10 max-w-7xl mx-auto w-full">
        {view === 'dashboard' && (
          <div className="space-y-6 md:space-y-8 animate-in fade-in">
            <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">{user.name} 선생님, 안녕하세요!</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-8">
              <DashboardCard icon={<Users className="text-blue-600"/>} title="관리 이용자" value={`${patients.length}명`} color="bg-blue-50" />
              <DashboardCard icon={<FileText className="text-emerald-600"/>} title="누적 일지" value={`${logs.length}건`} color="bg-emerald-50" />
              <DashboardCard icon={<ShieldCheck className="text-purple-600"/>} title="보호 상태" value="안전함" color="bg-purple-50" />
            </div>
            <section className="bg-white rounded-2xl md:rounded-[2rem] shadow-sm border p-6 md:p-8">
              <h3 className="text-lg md:text-xl font-black mb-4 md:mb-6 flex items-center gap-2"><Calendar className="text-emerald-500" /> 최근 일지</h3>
              <div className="space-y-3 md:space-y-4">
                {logs.slice(0, 5).map(log => (
                  <div key={log.id} className="p-4 bg-slate-50 rounded-xl md:rounded-2xl flex justify-between items-center hover:bg-emerald-50 cursor-pointer" onClick={() => { setSelectedPatientId(log.patientId); setView('patient_detail'); }}>
                    <div className="flex-1 pr-2">
                      <p className="font-black text-slate-700 truncate">{patients.find(p=>p.id===log.patientId)?.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase truncate">{log.date} | {log.activityName}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-slate-300 flex-shrink-0" />
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {view === 'patients' && (
          <div className="space-y-6 md:space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">이용자 차트</h2>
              <div className="relative w-full md:w-80">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input type="text" placeholder="이름 검색..." className="pl-12 pr-6 py-3 md:py-4 bg-white shadow-sm rounded-xl md:rounded-2xl outline-none w-full font-bold" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
              {patients.filter(p => p.name.includes(searchTerm)).map(patient => (
                <div key={patient.id} className="bg-white p-6 md:p-8 rounded-2xl md:rounded-[2rem] border border-slate-100 hover:shadow-xl cursor-pointer relative overflow-hidden" onClick={() => { setSelectedPatientId(patient.id); setView('patient_detail'); }}>
                  <h4 className="text-xl md:text-2xl font-black text-slate-800 mb-1">{patient.name} <span className="text-sm text-slate-400 font-bold">({patient.gender})</span></h4>
                  <p className="text-xs text-slate-400 font-black uppercase tracking-widest mb-4 md:mb-6">{patient.diagnosis}</p>
                  <div className="flex justify-between text-[11px] font-black uppercase"><span className="text-slate-400">개시일</span><span className="text-slate-700">{patient.therapyStartDate}</span></div>
                </div>
              ))}
              <div onClick={() => setView('add_patient')} className="border-4 border-dashed border-slate-200 p-6 md:p-8 rounded-2xl md:rounded-[2rem] flex flex-col items-center justify-center text-slate-300 hover:text-emerald-500 hover:border-emerald-500 cursor-pointer min-h-[140px] md:min-h-[160px] transition-all">
                <PlusCircle className="w-8 h-8 md:w-10 md:h-10 mb-2" />
                <p className="font-black text-xs md:text-sm uppercase">신규 이용자</p>
              </div>
            </div>
          </div>
        )}

        {view === 'patient_detail' && selectedPatient && (
          <div className="space-y-6 md:space-y-8 animate-in slide-in-from-right-4">
            <button onClick={() => setView('patients')} className="flex items-center gap-2 text-slate-400 hover:text-emerald-600 font-black text-xs uppercase"><ArrowLeft className="w-4 h-4" /> 차트 목록</button>
            <div className="bg-white rounded-2xl md:rounded-[3rem] shadow-2xl border p-6 md:p-12 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-2 md:w-3 h-full bg-emerald-500"></div>
              {isEditingPatient && editForm ? (
                <form onSubmit={handleUpdatePatient} className="space-y-6 md:space-y-8">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 md:pb-6 gap-4">
                    <h3 className="text-xl md:text-2xl font-black text-slate-800">정보 수정</h3>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button type="button" onClick={() => setIsEditingPatient(false)} className="flex-1 sm:flex-none px-4 py-2 font-black text-sm text-red-400">취소</button>
                      <button type="submit" className="flex-1 sm:flex-none bg-emerald-600 text-white px-6 py-2 rounded-xl font-black shadow-lg">수정 완료</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                    <FormGroup label="이름" value={editForm.name} onChange={v => setEditForm({...editForm, name: v})} />
                    <FormGroup label="개시일" type="date" value={editForm.therapyStartDate} onChange={v => setEditForm({...editForm, therapyStartDate: v})} />
                    <FormGroup label="종결일" type="date" value={editForm.terminationDate || ''} onChange={v => setEditForm({...editForm, terminationDate: v})} />
                    <FormGroup label="장애정도" value={editForm.disabilitySeverity} onChange={v => setEditForm({...editForm, disabilitySeverity: v as DisabilitySeverity})} />
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 p-4 md:p-6 bg-slate-50 rounded-2xl md:rounded-3xl border">
                    <div className="space-y-3 md:space-y-4">
                      <FormGroup label="초기 평가일" type="date" value={editForm.initialAssessmentDate} onChange={v => setEditForm({...editForm, initialAssessmentDate: v})} />
                      <textarea className="w-full p-4 rounded-xl border-none font-bold text-xs" rows={4} value={editForm.initialAssessment} onChange={e => setEditForm({...editForm, initialAssessment: e.target.value})} placeholder="초기 평가 내용" />
                    </div>
                    <div className="space-y-3 md:space-y-4">
                      <FormGroup label="중간 평가일" type="date" value={editForm.interimAssessmentDate} onChange={v => setEditForm({...editForm, interimAssessmentDate: v})} />
                      <textarea className="w-full p-4 rounded-xl border-none font-bold text-xs" rows={4} value={editForm.interimAssessment} onChange={e => setEditForm({...editForm, interimAssessment: e.target.value})} placeholder="중간 평가 내용" />
                    </div>
                    <div className="space-y-3 md:space-y-4">
                      <FormGroup label="종결 평가일" type="date" value={editForm.finalAssessmentDate} onChange={v => setEditForm({...editForm, finalAssessmentDate: v})} />
                      <textarea className="w-full p-4 rounded-xl border-none font-bold text-xs" rows={4} value={editForm.finalAssessment} onChange={e => setEditForm({...editForm, finalAssessment: e.target.value})} placeholder="종결 평가 내용" />
                    </div>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex items-center gap-4 md:gap-6 mb-6 md:mb-10">
                    <h2 className="text-3xl md:text-5xl font-black text-slate-800 tracking-tighter truncate">{selectedPatient.name}</h2>
                    <button onClick={() => {setEditForm({...selectedPatient}); setIsEditingPatient(true);}} className="p-2 md:p-3 text-slate-300 hover:text-emerald-600">
                      <Edit3 className="w-6 h-6 md:w-8 md:h-8" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8 mb-8 md:mb-12 p-4 md:p-8 bg-slate-50 rounded-2xl md:rounded-[2.5rem] border shadow-inner">
                    <InfoItem icon={<CalendarDays/>} label="개시일" value={selectedPatient.therapyStartDate} />
                    <InfoItem icon={<CalendarDays/>} label="종결일" value={selectedPatient.terminationDate || '진행 중'} color={selectedPatient.terminationDate ? 'text-red-500' : 'text-emerald-500'} />
                    <InfoItem icon={<Users/>} label="장애정도" value={selectedPatient.disabilitySeverity} />
                    <InfoItem icon={<Activity/>} label="진단명" value={selectedPatient.diagnosis} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                    <AssessmentBox title="초기 평가" date={selectedPatient.initialAssessmentDate} content={selectedPatient.initialAssessment} isExpanded={expandedAssessments['initial']} onToggle={() => toggleAssessment('initial')} theme="emerald" />
                    <AssessmentBox title="중간 평가" date={selectedPatient.interimAssessmentDate} content={selectedPatient.interimAssessment} isExpanded={expandedAssessments['interim']} onToggle={() => toggleAssessment('interim')} theme="blue" />
                    <AssessmentBox title="종결 평가" date={selectedPatient.finalAssessmentDate} content={selectedPatient.finalAssessment} isExpanded={expandedAssessments['final']} onToggle={() => toggleAssessment('final')} theme="purple" />
                  </div>
                  <div className="mt-8 md:mt-16 flex justify-center md:justify-end">
                    <button onClick={() => setView('generate_log')} className="w-full md:w-auto px-6 md:px-12 py-4 md:py-6 bg-emerald-600 text-white rounded-xl md:rounded-[2.5rem] font-black text-lg md:text-2xl flex items-center justify-center gap-3 md:gap-4 hover:bg-emerald-700 shadow-2xl active:scale-95">
                      <Sparkles className="w-6 h-6 md:w-10 md:h-10" /> 일지 자동 생성
                    </button>
                  </div>
                </>
              )}
            </div>
            <div className="space-y-4 md:space-y-8 pb-10 md:pb-20">
              <h3 className="text-xl md:text-2xl font-black text-slate-800 px-2 md:px-4">치료 수행 기록</h3>
              {logs.filter(l => l.patientId === selectedPatient.id).map(log => (
                <div key={log.id} className="bg-white rounded-2xl md:rounded-[2.5rem] shadow-sm border overflow-hidden hover:shadow-xl transition-all">
                  <div className="bg-slate-50 px-6 md:px-10 py-4 md:py-6 flex justify-between items-center border-b gap-2">
                    <span className="font-black text-slate-500 text-sm md:text-lg tracking-tight md:tracking-widest truncate">{log.date} | {log.activityName}</span>
                    <button onClick={() => handleDeleteLog(log.id)} className={`flex-shrink-0 px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-[10px] md:text-xs font-black transition-all ${deleteConfirmId === log.id ? 'bg-red-500 text-white' : 'text-slate-300 hover:text-red-500'}`}>{deleteConfirmId === log.id ? '삭제확인' : '삭제'}</button>
                  </div>
                  <div className="p-6 md:p-10">
                    <div className="text-sm md:text-base text-slate-700 leading-relaxed font-bold border-l-4 md:border-l-8 border-emerald-500 pl-4 md:pl-8 whitespace-pre-wrap">
                      {log.generatedLog}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'add_patient' && (
          <div className="max-w-5xl mx-auto bg-white p-6 md:p-16 rounded-2xl md:rounded-[4rem] shadow-2xl border animate-in fade-in">
            <h2 className="text-2xl md:text-4xl font-black mb-8 md:mb-12 text-slate-800 flex items-center gap-3 uppercase tracking-tighter">
              <UserPlus className="text-emerald-600 w-8 h-8 md:w-12 md:h-12" /> 신규 이용자 등록
            </h2>
            <form onSubmit={handleAddPatient} className="space-y-6 md:space-y-10">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-8">
                <FormGroup label="이름" value={newPatientForm.name} onChange={v => setNewPatientForm({...newPatientForm, name: v})} required />
                <FormGroup label="생년월일" type="date" value={newPatientForm.birthDate} onChange={v => setNewPatientForm({...newPatientForm, birthDate: v})} required />
                <FormGroup label="치료 개시일" type="date" value={newPatientForm.therapyStartDate} onChange={v => setNewPatientForm({...newPatientForm, therapyStartDate: v})} required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-8">
                <FormGroup label="진단명" value={newPatientForm.diagnosis} onChange={v => setNewPatientForm({...newPatientForm, diagnosis: v as Diagnosis})} />
                <FormGroup label="장애정도" value={newPatientForm.disabilitySeverity} onChange={v => setNewPatientForm({...newPatientForm, disabilitySeverity: v as DisabilitySeverity})} />
              </div>
              <div className="space-y-6 md:space-y-8 p-4 md:p-8 bg-slate-50 rounded-2xl md:rounded-[3rem] border">
                <h3 className="text-base md:text-lg font-black text-slate-700">평가 기록 및 일자</h3>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="space-y-2 md:space-y-3">
                    <FormGroup label="초기 평가일" type="date" value={newPatientForm.initialAssessmentDate} onChange={v => setNewPatientForm({...newPatientForm, initialAssessmentDate: v})} />
                    <textarea className="w-full p-4 rounded-xl md:rounded-2xl border-none text-xs font-bold" rows={4} placeholder="초기 평가 내용" value={newPatientForm.initialAssessment} onChange={e => setNewPatientForm({...newPatientForm, initialAssessment: e.target.value})} />
                  </div>
                  <div className="space-y-2 md:space-y-3">
                    <FormGroup label="중간 평가일" type="date" value={newPatientForm.interimAssessmentDate} onChange={v => setNewPatientForm({...newPatientForm, interimAssessmentDate: v})} />
                    <textarea className="w-full p-4 rounded-xl md:rounded-2xl border-none text-xs font-bold" rows={4} placeholder="중간 평가 내용" value={newPatientForm.interimAssessment} onChange={e => setNewPatientForm({...newPatientForm, interimAssessment: e.target.value})} />
                  </div>
                  <div className="space-y-2 md:space-y-3">
                    <FormGroup label="종결 평가일" type="date" value={newPatientForm.finalAssessmentDate} onChange={v => setNewPatientForm({...newPatientForm, finalAssessmentDate: v})} />
                    <textarea className="w-full p-4 rounded-xl md:rounded-2xl border-none text-xs font-bold" rows={4} placeholder="종결 평가 내용" value={newPatientForm.finalAssessment} onChange={e => setNewPatientForm({...newPatientForm, finalAssessment: e.target.value})} />
                  </div>
                </div>
              </div>
              <FormGroup label="치료 목표 (쉼표 구분)" value={newPatientForm.goals} onChange={v => setNewPatientForm({...newPatientForm, goals: v})} required />
              <div className="flex flex-col sm:flex-row gap-4 pt-4 md:pt-10">
                <button type="button" onClick={() => setView('patients')} className="w-full sm:flex-1 px-8 py-4 border-2 rounded-xl md:rounded-2xl font-black uppercase text-slate-400">취소</button>
                <button type="submit" className="w-full sm:flex-1 px-8 py-4 bg-emerald-600 text-white font-black rounded-xl md:rounded-2xl hover:bg-emerald-700 shadow-2xl uppercase">차트 생성</button>
              </div>
            </form>
          </div>
        )}

        {view === 'data_management' && (
          <div className="max-w-3xl mx-auto space-y-6 md:space-y-8 animate-in fade-in">
            <h2 className="text-2xl md:text-3xl font-black text-slate-800">데이터 백업 및 복구</h2>
            <div className="bg-white p-6 md:p-10 rounded-2xl md:rounded-[2.5rem] shadow-xl border space-y-8 md:space-y-10">
              <section className="space-y-3 md:space-y-4">
                <h3 className="text-base md:text-lg font-black flex items-center gap-2"><Download className="text-emerald-500"/> 내보내기</h3>
                <p className="text-xs md:text-sm text-slate-500 font-medium">현재 데이터를 파일로 저장합니다.</p>
                <button onClick={handleExportData} className="w-full sm:w-auto px-6 md:px-8 py-3 md:py-4 bg-emerald-600 text-white rounded-xl md:rounded-2xl font-black shadow-lg">백업 파일 다운로드</button>
              </section>
              <div className="border-t"></div>
              <section className="space-y-3 md:space-y-4">
                <h3 className="text-base md:text-lg font-black flex items-center gap-2"><Upload className="text-blue-500"/> 가져오기</h3>
                <p className="text-xs md:text-sm text-slate-500 font-medium text-red-500">주의: 기존 데이터가 교체됩니다.</p>
                <label className="inline-block w-full sm:w-auto px-6 md:px-8 py-3 md:py-4 bg-blue-600 text-white rounded-xl md:rounded-2xl font-black shadow-lg cursor-pointer text-center">
                  파일 선택
                  <input type="file" accept=".json" onChange={handleImportData} className="hidden" />
                </label>
              </section>
            </div>
          </div>
        )}

        {view === 'generate_log' && selectedPatient && (
          <div className="max-w-3xl mx-auto animate-in slide-in-from-bottom-8">
            <button onClick={() => setView('patient_detail')} className="mb-6 md:mb-10 flex items-center gap-2 text-slate-400 hover:text-emerald-600 font-black text-xs uppercase"><ArrowLeft className="w-4 h-4" /> 돌아가기</button>
            <div className="bg-white p-8 md:p-16 rounded-3xl md:rounded-[4rem] shadow-2xl border relative overflow-hidden">
              <div className="absolute top-0 left-0 w-2 md:w-4 h-full bg-emerald-500"></div>
              <h2 className="text-2xl md:text-4xl font-black mb-2 md:mb-3 text-slate-800 tracking-tighter">5일치 일지 자동 생성</h2>
              <p className="text-slate-400 mb-8 md:mb-12 font-bold uppercase tracking-widest text-[10px] md:text-xs">지정 양식(*제목 5줄, *상담내용)으로 작성됩니다.</p>
              <form onSubmit={handleGenerateBatchLogs} className="space-y-6 md:space-y-10">
                <FormGroup label="치료 시작일" type="date" required defaultValue={new Date().toISOString().split('T')[0]} />
                <div className="space-y-2 md:space-y-4">
                  <label className="block text-[10px] font-black text-slate-500 uppercase ml-1">이번 주 주요 활동</label>
                  <textarea name="activity" rows={4} className="w-full p-6 md:p-8 bg-slate-50 border-none rounded-2xl md:rounded-[2.5rem] outline-none font-bold text-slate-700 shadow-inner" placeholder="예: 소근육 활동, 시지각 훈련 등"></textarea>
                </div>
                <button type="submit" disabled={isGenerating} className={`w-full py-5 md:py-8 rounded-xl md:rounded-[2.5rem] font-black text-lg md:text-2xl shadow-2xl flex items-center justify-center gap-3 md:gap-4 transition-all ${isGenerating ? 'bg-slate-200' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
                  {isGenerating ? <><Loader2 className="w-8 h-8 md:w-10 md:h-10 animate-spin" /> 생성 중...</> : <><Sparkles className="w-8 h-8 md:w-10 md:h-10"/> 생성하기</>}
                </button>
              </form>
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
    <div className={`${color} p-6 md:p-10 rounded-2xl md:rounded-[3rem] border border-white shadow-sm flex items-center gap-6 md:gap-10 group transition-all hover:scale-[1.02]`}>
      <div className="bg-white p-4 md:p-6 rounded-xl md:rounded-[1.5rem] shadow-lg group-hover:rotate-6 transition-transform">
        {React.cloneElement(icon as React.ReactElement, { className: "w-6 h-6 md:w-8 md:h-8" })}
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
        <p className="text-2xl md:text-4xl font-black text-slate-800 tracking-tighter">{value}</p>
      </div>
    </div>
  );
}

function InfoItem({ icon, label, value, color = "text-slate-800" }: any) {
  return (
    <div className="space-y-1 md:space-y-2">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
        {React.cloneElement(icon as React.ReactElement, { className: "w-3 h-3" })} {label}
      </p>
      <div className={`text-xs md:text-sm font-black tracking-tight ${color} truncate`}>{value}</div>
    </div>
  );
}

function AssessmentBox({ title, date, content, isExpanded, onToggle, theme }: any) {
  const bgMap: any = { emerald: 'bg-emerald-50/50 border-emerald-100', blue: 'bg-blue-50/50 border-blue-100', purple: 'bg-purple-50/50 border-purple-100' };
  const textMap: any = { emerald: 'text-emerald-600', blue: 'text-blue-600', purple: 'text-purple-600' };

  return (
    <div className={`${bgMap[theme]} p-5 md:p-8 rounded-2xl md:rounded-[2.5rem] border relative group transition-all flex flex-col min-h-[140px] md:min-h-[160px]`}>
      <div className="flex justify-between items-start mb-4">
        <div className="pr-2">
          <p className={`text-[10px] font-black ${textMap[theme]} uppercase tracking-widest`}>{title}</p>
          <p className="text-[10px] md:text-[11px] font-black text-slate-400">{date || '미입력'}</p>
        </div>
        <button onClick={onToggle} className="flex-shrink-0 text-[10px] bg-white border border-slate-100 px-3 md:px-4 py-1.5 rounded-full font-black text-slate-500 hover:bg-slate-50 flex items-center gap-1 transition-all shadow-sm">
          {isExpanded ? <><ChevronUp className="w-3 h-3"/> 접기</> : <><ChevronDown className="w-3 h-3"/> 전체</>}
        </button>
      </div>
      <div className={`text-xs md:text-[13px] text-slate-600 leading-relaxed font-bold whitespace-pre-wrap transition-all overflow-hidden ${isExpanded ? 'max-h-[2000px]' : 'max-h-[50px] md:max-h-[60px] line-clamp-2'}`}>
        {content || "기록 없음"}
      </div>
    </div>
  );
}

function FormGroup({ label, type = "text", value, onChange, required = false, defaultValue }: any) {
  if (type === "select" || label === "진단명" || label === "장애정도") {
    const options = label === "진단명" ? Object.values(Diagnosis) : Object.values(DisabilitySeverity);
    return (
      <div className="flex flex-col gap-1 md:gap-2">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
        <select value={value} onChange={e => onChange(e.target.value)} className="p-3 md:p-4 bg-slate-50 border-none rounded-xl md:rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500">
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1 md:gap-2">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      <input type={type} value={value} defaultValue={defaultValue} onChange={e => onChange(e.target.value)} required={required} className="p-3 md:p-4 bg-slate-50 border-none rounded-xl md:rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500" />
    </div>
  );
}
