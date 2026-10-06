import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)

const sanitizeInput = (str) => {
  if (!str) return ""
  return String(str).trim().slice(0, 254).replace(/[<>]/g, "")
}
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)

// ==================== NEW: ATTENDANCE MODULE (V2 - uses enrollments) ====================
function AttendanceModule({ profile, classes, enrollments, users }){
  const [selectedClass, setSelectedClass] = useState(classes[0]?.id || "")
  const [date, setDate] = useState(new Date().toISOString().slice(0,10))
  const [records, setRecords] = useState({})
  const [existing, setExisting] = useState([])
  const [saving, setSaving] = useState(false)
  const [currentYear, setCurrentYear] = useState(null)
  const [currentTerm, setCurrentTerm] = useState(null)

  useEffect(()=>{ (async()=>{
    const y = await supabase.from('academic_years').select('*').eq('is_current',true).single(); if(y.data) setCurrentYear(y.data)
    const t = await supabase.from('terms').select('*').limit(1).single(); if(t.data) setCurrentTerm(t.data)
  })()},[])

  useEffect(()=>{ if(classes[0] &&!selectedClass) setSelectedClass(classes[0].id) },[classes])

  const studentsInClass = users.filter(u => enrollments.filter(e=>e.class_id===selectedClass).map(e=>e.student_id).includes(u.id))

  const loadAttendance = async()=>{
    if(!selectedClass ||!date) return
    const {data} = await supabase.from('attendance').select('*').eq('class_id', selectedClass).eq('date', date)
    if(data){
      setExisting(data)
      const map={}
      data.forEach(r=> map[r.student_id]=r.status)
      setRecords(map)
    } else { setExisting([]); setRecords({}) }
  }
  useEffect(()=>{ loadAttendance() },[selectedClass, date])

  const setStatus = (studentId, status)=> setRecords(prev=> ({...prev, [studentId]: status}))

  const saveAll = async()=>{
    if(!selectedClass) return alert("Select class")
    setSaving(true)
    for(const s of studentsInClass){
      const status = records[s.id] || 'present'
      const existingRec = existing.find(e=>e.student_id===s.id)
      if(existingRec){
        await supabase.from('attendance').update({status, marked_by: profile.id}).eq('id', existingRec.id)
      } else {
        await supabase.from('attendance').insert({
          student_id: s.id,
          class_id: selectedClass,
          academic_year_id: currentYear?.id,
          term_id: currentTerm?.id,
          date,
          status,
          marked_by: profile.id
        })
      }
    }
    setSaving(false)
    alert(`Attendance saved for ${studentsInClass.length} students - ${date}`)
    loadAttendance()
  }

  const markAll = (status)=>{
    const map={}
    studentsInClass.forEach(s=> map[s.id]=status)
    setRecords(map)
  }

  const stats = {
    present: Object.values(records).filter(v=>v==='present').length,
    absent: Object.values(records).filter(v=>v==='absent').length,
    late: Object.values(records).filter(v=>v==='late').length,
    excused: Object.values(records).filter(v=>v==='excused').length,
  }

  return (
    <div className="space-y-4">
      <div className="bg-zinc-900/70 border border-white/10 p-4 rounded-[20px] flex flex-col md:flex-row gap-3 md:items-center justify-between">
        <div className="flex gap-2">
          <select value={selectedClass} onChange={e=>setSelectedClass(e.target.value)} className="bg-zinc-800 border border-white/10 p-3 rounded-xl text-white text-sm">
            {classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="bg-zinc-800 border border-white/10 p-3 rounded-xl text-white text-sm"/>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={()=>markAll('present')} className="bg-green-600/20 text-green-400 px-3 py-2 rounded-full text-xs font-bold">All Present</button>
          <button onClick={()=>markAll('absent')} className="bg-red-600/20 text-red-400 px-3 py-2 rounded-full text-xs font-bold">All Absent</button>
          <button onClick={saveAll} disabled={saving} className="bg-orange-600 text-white px-5 py-2 rounded-full text-xs font-black disabled:opacity-50">{saving?'Saving...':'Save Attendance'}</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-2xl"><p className="text-[10px] text-green-400 uppercase">Present</p><p className="text-2xl font-black text-white">{stats.present}</p></div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-2xl"><p className="text-[10px] text-yellow-400 uppercase">Late</p><p className="text-2xl font-black text-white">{stats.late}</p></div>
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl"><p className="text-[10px] text-red-400 uppercase">Absent</p><p className="text-2xl font-black text-white">{stats.absent}</p></div>
      </div>

      <div className="bg-zinc-900/70 border border-white/10 rounded-[24px] overflow-hidden">
        <div className="grid grid-cols-[1fr_70px_70px_70px] md:grid-cols-[1fr_90px_90px_90px_90px] gap-2 p-3 bg-black/40 text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
          <div>Student ({studentsInClass.length})</div><div className="text-center">Present</div><div className="text-center">Late</div><div className="text-center">Absent</div><div className="text-center hidden md:block">Excused</div>
        </div>
        <div className="divide-y divide-white/5 max-h-[500px] overflow-auto">
          {studentsInClass.map(s=>{
            const cur = records[s.id] || 'present'
            return (
              <div key={s.id} className="grid grid-cols-[1fr_70px_70px_70px] md:grid-cols-[1fr_90px_90px_90px_90px] gap-2 p-3 items-center hover:bg-white/[0.03]">
                <div className="flex items-center gap-2 min-w-0"><div className="w-8 h-8 bg-orange-600/20 rounded-full flex items-center justify-center font-black text-orange-400 text-xs">{s.full_name?.[0]||s.email[0].toUpperCase()}</div><div className="min-w-0"><p className="text-sm font-bold text-white truncate">{s.full_name||s.email}</p><p className="text-[11px] text-zinc-500 truncate">{s.email}</p></div></div>
                <button onClick={()=>setStatus(s.id,'present')} className={`py-2 rounded-xl text-xs font-bold ${cur==='present'?'bg-green-600 text-white':'bg-zinc-800 text-zinc-400'}`}>✅</button>
                <button onClick={()=>setStatus(s.id,'late')} className={`py-2 rounded-xl text-xs font-bold ${cur==='late'?'bg-yellow-600 text-white':'bg-zinc-800 text-zinc-400'}`}>⏰</button>
                <button onClick={()=>setStatus(s.id,'absent')} className={`py-2 rounded-xl text-xs font-bold ${cur==='absent'?'bg-red-600 text-white':'bg-zinc-800 text-zinc-400'}`}>❌</button>
                <button onClick={()=>setStatus(s.id,'excused')} className={`py-2 rounded-xl text-xs font-bold hidden md:block ${cur==='excused'?'bg-blue-600 text-white':'bg-zinc-800 text-zinc-400'}`}>📝</button>
              </div>
            )
          })}
          {studentsInClass.length===0 && <p className="p-10 text-center text-zinc-500 text-sm">No students in this class. Admin must enroll students via enrollments table.</p>}
        </div>
      </div>
    </div>
  )
}

function StudentAttendanceView({profile}){
  const [att, setAtt] = useState([])
  useEffect(()=>{(async()=>{
    const {data} = await supabase.from('attendance').select('*').eq('student_id', profile.id).order('date',{ascending:false}).limit(30)
    if(data) setAtt(data)
  })()},[])
  const present = att.filter(a=>a.status==='present').length
  const rate = att.length? Math.round(present/att.length*100) : 0
  return (
    <div className="bg-zinc-900/70 border border-white/10 rounded-[24px] p-5">
      <div className="flex justify-between items-center mb-3"><h4 className="font-black text-white">My Attendance - {rate}%</h4><span className="text-xs text-zinc-500">{att.length} days</span></div>
      <div className="w-full bg-zinc-800 rounded-full h-2 mb-4"><div className="bg-green-500 h-2 rounded-full transition-all" style={{width:`${rate}%`}}></div></div>
      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
        <div className="bg-green-500/10 p-2 rounded-xl"><p className="text-green-400 font-black">{att.filter(a=>a.status==='present').length}</p><p className="text-[10px] text-zinc-500">Present</p></div>
        <div className="bg-yellow-500/10 p-2 rounded-xl"><p className="text-yellow-400 font-black">{att.filter(a=>a.status==='late').length}</p><p className="text-[10px] text-zinc-500">Late</p></div>
        <div className="bg-red-500/10 p-2 rounded-xl"><p className="text-red-400 font-black">{att.filter(a=>a.status==='absent').length}</p><p className="text-[10px] text-zinc-500">Absent</p></div>
      </div>
      <div className="space-y-2 max-h-[300px] overflow-auto">{att.map(a=><div key={a.id} className="flex justify-between text-sm bg-black/30 p-2.5 rounded-xl"><span className="text-zinc-400">{a.date}</span><span className={`font-bold ${a.status==='present'?'text-green-400':a.status==='absent'?'text-red-400':a.status==='late'?'text-yellow-400':'text-blue-400'}`}>{a.status.toUpperCase()}</span></div>)}{att.length===0 && <p className="text-xs text-zinc-500 text-center py-4">No attendance records yet. Faculty will mark daily.</p>}</div>
    </div>
  )
}
// ==================== END ATTENDANCE MODULE ====================

function AppWrapper(){
  const [user,setUser]=useState(null)
  const [profile,setProfile]=useState(null)
  const [loading,setLoading]=useState(true)
  const [mode,setMode]=useState("login")
  const [form,setForm]=useState({email:"",password:"",full_name:"",role:"student"})
  const [attempts,setAttempts]=useState(0)
  const [lockedUntil,setLockedUntil]=useState(null)
  const [submitting,setSubmitting]=useState(false)

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{
      setUser(data.session?.user||null)
      if(data.session?.user) fetchProfile(data.session.user.id)
      else setLoading(false)
    })
    const {data:listener}=supabase.auth.onAuthStateChange((_e,session)=>{
      setUser(session?.user||null)
      if(session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false)}
    })
    return ()=>listener.subscription.unsubscribe()
  },[])

  const fetchProfile=async(uid)=>{
    const {data}=await supabase.from('users').select('*').eq('id',uid).single()
    setProfile(data||null); setLoading(false)
  }

  const handleAuth=async(e)=>{
    e.preventDefault()
    if(lockedUntil && Date.now()<lockedUntil){
      const sec=Math.ceil((lockedUntil-Date.now())/1000)
      return alert(`Too many tries. Wait ${sec}s`)
    }
    if(submitting) return
    setSubmitting(true)
    try{
      const cleanEmail=sanitizeInput(form.email).toLowerCase()
      const cleanPassword=form.password.trim().slice(0,72)
      const cleanName=sanitizeInput(form.full_name).slice(0,50)
      if(!isValidEmail(cleanEmail)){ alert("Enter a valid email"); return }
      if(cleanPassword.length<6){ alert("Password must be 6+ chars"); return }
      if(mode==="signup" && cleanName.length<2){ alert("Enter full name"); return }
      if(mode==="signup"){
        let safeRole="student"
        if(["student","faculty","parent"].includes(form.role)) safeRole=form.role
        const {data,error}=await supabase.auth.signUp({email:cleanEmail,password:cleanPassword,options:{data:{full_name:cleanName}}})
        if(error) throw error
        await supabase.from('users').insert({id:data.user.id,email:cleanEmail,full_name:cleanName,role:safeRole,is_active:false})
        alert("Account created! Wait for Admin approval.")
        setMode("login")
        setForm({email:"",password:"",full_name:"",role:"student"})
      } else {
        const {data,error}=await supabase.auth.signInWithPassword({email:cleanEmail,password:cleanPassword})
        if(error) throw error
        const {data:prof}=await supabase.from('users').select('*').eq('id',data.user.id).single()
        if(prof &&!prof.is_active){ alert("Account pending approval"); await supabase.auth.signOut(); return }
        setUser(data.user); setProfile(prof); setAttempts(0)
      }
    }catch(err){
      const n=attempts+1; setAttempts(n)
      if(n>=5){ setLockedUntil(Date.now()+30000); alert("Too many failed attempts. Locked 30s") }
      else alert("Invalid email or password")
    }finally{ setSubmitting(false) }
  }

  const logout=async()=>{ await supabase.auth.signOut(); setUser(null); setProfile(null) }
  if(loading) return <div className="min-h-screen bg-[#080808] flex items-center justify-center text-white">Loading MARS...</div>
  if(!user) return <AuthPage mode={mode} setMode={setMode} form={form} setForm={setForm} onSubmit={handleAuth} lockedUntil={lockedUntil} submitting={submitting} />
  const role=(profile?.role||'').toLowerCase().trim()
  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <header className="sticky top-0 z-50 bg-black/90 backdrop-blur border-b border-white/10 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2"><div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center font-black text-white">M</div><span className="font-black text-white">MARS V2</span><span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full ml-2 text-white">{profile?.role} • attendance</span></div>
        <div className="flex items-center gap-2"><span className="text-xs text-zinc-400 hidden sm:block">{profile?.email}</span><button onClick={logout} className="bg-zinc-800 text-white px-3 py-1.5 rounded-full text-xs">Logout</button></div>
      </header>
      <main className="p-3 md:p-6">
        {["super_admin","school_admin","admin"].includes(role)? <AdminDash profile={profile} /> : null}
        {["faculty","teacher"].includes(role)? <FacultyDash profile={profile} /> : null}
        {role==="student"? <StudentDash profile={profile} /> : null}
        {role==="parent"? <ParentDash profile={profile} /> : null}
      </main>
    </div>
  )
}

function AuthPage({mode,setMode,form,setForm,onSubmit,lockedUntil,submitting}){
  const isLocked=lockedUntil && Date.now()<lockedUntil
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{background:'#080808'}}>
      <div className="p-6 md:p-8 rounded-[24px] w-full max-w-[400px] border border-white/10" style={{background:'#18181b'}}>
        <div className="flex items-center gap-2 mb-6"><div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center font-black text-white">M</div><div><p className="font-black text-white">MARS E-School V2</p><p className="text-[10px] text-emerald-400">🛡️ Attendance Live</p></div></div>
        <h2 className="text-2xl font-black text-white mb-4">{mode==="login"?"Welcome Back":"Create Account"}</h2>
        <form onSubmit={onSubmit} className="space-y-3" noValidate>
          <input value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="Email" type="email" required maxLength={254} className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white placeholder:text-zinc-500"/>
          <input value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Password" type="password" required maxLength={72} className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white placeholder:text-zinc-500"/>
          {mode==="signup" && <>
            <input value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} placeholder="Full Name" required maxLength={50} className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white placeholder:text-zinc-500"/>
            <select value={form.role} onChange={e=>setForm({...form,role:e.target.value})} className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white"><option value="student">Student</option><option value="faculty">Faculty / Teacher</option><option value="parent">Parent</option></select>
          </>}
          <button disabled={submitting||isLocked} type="submit" className="w-full bg-orange-600 py-3.5 rounded-2xl font-black text-white disabled:opacity-50">{submitting?"Please wait...":isLocked?"Locked - Wait 30s":mode==="login"?"Login":"Sign Up"}</button>
        </form>
        <p className="text-center text-sm text-zinc-400 mt-4"><button onClick={()=>setMode(mode==="login"?"signup":"login")} className="text-orange-400 font-bold">{mode==="login"?"Sign Up":"Login"}</button></p>
      </div>
    </div>
  )
}

function AdminDash({profile}){
  const [users,setUsers]=useState([]); const [classes,setClasses]=useState([]); const [enrollments,setEnrollments]=useState([])
  const [tab,setTab]=useState("classes")
  const [classForm,setClassForm]=useState({name:"",faculty_id:"",student_ids:[]})
  const [editClassId,setEditClassId]=useState(null)
  const [addStudentIds,setAddStudentIds]=useState([])
  const [currentYear,setCurrentYear]=useState(null)
  const [currentTerm,setCurrentTerm]=useState(null)

  const load=async()=>{
    const {data:u}=await supabase.from('users').select('*').order('created_at',{ascending:false}); if(u) setUsers(u)
    const {data:c}=await supabase.from('classes').select('*').order('name'); if(c) setClasses(c)
    const {data:e}=await supabase.from('enrollments').select('*'); if(e) setEnrollments(e)
    const {data:y}=await supabase.from('academic_years').select('*').eq('is_current',true).single(); if(y) setCurrentYear(y)
    const {data:t}=await supabase.from('terms').select('*').limit(1).single(); if(t) setCurrentTerm(t)
  }
  useEffect(()=>{load()},[])
  const facultyList=users.filter(u=>["faculty","teacher"].includes((u.role||'').toLowerCase().trim()))
  const studentList=users.filter(u=>(u.role||'').toLowerCase()==="student")
  const pending=users.filter(u=>!u.is_active)

  const getStudentsForClass=(classId)=>{
    const studentIds=enrollments.filter(e=>e.class_id===classId).map(e=>e.student_id)
    return users.filter(u=>studentIds.includes(u.id))
  }

  const toggleStudentInForm=(id)=> setClassForm(prev=> prev.student_ids.includes(id)? {...prev, student_ids: prev.student_ids.filter(s=>s!==id)} : {...prev, student_ids: [...prev.student_ids, id]} )

  const createClass=async()=>{
    const cleanName=sanitizeInput(classForm.name)
    if(!cleanName) return alert("Name needed")
    const {data:cls,error}=await supabase.from('classes').insert({name:cleanName,faculty_id:classForm.faculty_id||null, academic_year_id: currentYear?.id || null}).select().single()
    if(error) return alert(error.message)
    if(classForm.student_ids.length>0){
      const rows=classForm.student_ids.map(sid=>({student_id:sid, class_id:cls.id, academic_year_id: currentYear?.id || null, term_id: currentTerm?.id || null, status:'active'}))
      const {error:eErr}=await supabase.from('enrollments').insert(rows)
      if(eErr) alert("Enroll error: "+eErr.message)
      await supabase.from('users').update({class_id:cls.id}).in('id',classForm.student_ids)
    }
    setClassForm({name:"",faculty_id:"",student_ids:[]}); load()
  }

  const addStudentsToClass=async(classId)=>{
    if(addStudentIds.length===0) return
    const rows=addStudentIds.map(sid=>({student_id:sid, class_id:classId, academic_year_id: currentYear?.id || null, term_id: currentTerm?.id || null, status:'active'}))
    const {error}=await supabase.from('enrollments').insert(rows)
    if(error) return alert(error.message)
    await supabase.from('users').update({class_id:classId}).in('id',addStudentIds)
    setAddStudentIds([]); setEditClassId(null); load()
  }

  const removeStudentFromClass=async(classId,studentId)=>{
    await supabase.from('enrollments').delete().eq('class_id',classId).eq('student_id',studentId)
    await supabase.from('users').update({class_id:null}).eq('id',studentId)
    load()
  }

  const exportClasses=()=>{
    const rows=[]
    classes.forEach(c=>{
      const faculty=users.find(u=>u.id===c.faculty_id)
      const students=getStudentsForClass(c.id)
      if(students.length===0) rows.push({Class:c.name,Faculty:faculty?.email||'No faculty',Student_Email:'No students'})
      else students.forEach(s=>rows.push({Class:c.name,Faculty:faculty?.email||'No faculty',Student_Email:s.email,Student_Name:s.full_name}))
    })
    const ws=XLSX.utils.json_to_sheet(rows); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"Roster"); XLSX.writeFile(wb,`MARS-Roster-V2-${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  return (
    <div className="space-y-6 max-w-[1300px] mx-auto w-full">
      <div className="flex gap-2 flex-wrap"><button onClick={exportClasses} className="bg-orange-600 text-white px-4 py-2 rounded-full text-xs font-black">🏫 Export Classes + Roster V2</button><span className="text-xs text-zinc-500 bg-zinc-900 px-3 py-2 rounded-full border border-white/10">Year: {currentYear?.name||'2026'} | Term: {currentTerm?.name||'Term 3'} | Enrollments: {enrollments.length}</span></div>
      <div className="flex gap-2 bg-zinc-900/80 p-1 rounded-full overflow-x-auto border border-white/10">{[{id:"classes",l:`Classes (${classes.length})`},{id:"users",l:"All Users"},{id:"approvals",l:`Approvals (${pending.length})`}].map(t=><button key={t.id} onClick={()=>setTab(t.id)} className={`px-5 py-2.5 rounded-full text-sm font-bold shrink-0 ${tab===t.id?'bg-orange-600 text-white':'text-zinc-400'}`}>{t.l}</button>)}</div>
      {tab==="classes" && (
        <div className="space-y-6">
          <div className="bg-zinc-900/70 border border-white/10 p-4 md:p-6 rounded-[24px]">
            <h3 className="font-black mb-4 text-white">Create Class + Assign Faculty + Students (V2 - uses enrollments)</h3>
            <input value={classForm.name} onChange={e=>setClassForm({...classForm,name:e.target.value})} placeholder="e.g Form 1A" maxLength={30} className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl mb-3 text-white placeholder:text-zinc-500"/>
            <select value={classForm.faculty_id} onChange={e=>setClassForm({...classForm,faculty_id:e.target.value})} className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl mb-3 text-white"><option value="">Select Faculty (Teacher)</option>{facultyList.map(f=><option key={f.id} value={f.id}>{f.full_name||f.email} - {f.email}</option>)}</select>
            <p className="text-xs text-zinc-400 mb-2">Select Students ({classForm.student_ids.length} selected):</p>
            <div className="bg-black/40 border border-white/5 rounded-2xl p-3 max-h-[200px] overflow-auto grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
              {studentList.map(s=>{const checked=classForm.student_ids.includes(s.id); return <label key={s.id} className={`flex items-center gap-2 p-2 rounded-xl cursor-pointer border ${checked?'bg-orange-600/20 border-orange-500/30':'bg-zinc-800/50 border-white/5'}`}><input type="checkbox" checked={checked} onChange={()=>toggleStudentInForm(s.id)}/><span className="text-xs text-white truncate">{s.email}</span></label>})}
            </div>
            <button onClick={createClass} className="w-full bg-orange-600 py-3.5 rounded-2xl font-black text-white">Create Class with {classForm.student_ids.length} Students</button>
          </div>
          <div className="grid gap-4">{classes.map(c=>{
            const faculty=users.find(u=>u.id===c.faculty_id); const students=getStudentsForClass(c.id); const isEditing=editClassId===c.id
            return (
              <div key={c.id} className="bg-zinc-900/80 border border-white/10 p-4 md:p-5 rounded-[24px]">
                <div className="flex flex-col md:flex-row justify-between gap-3">
                  <div><p className="font-black text-white text-lg">{c.name}</p><p className="text-xs text-zinc-400">Faculty: <span className="text-white">{faculty?.email||'Not assigned'}</span> • {students.length} students (via enrollments)</p></div>
                  <div className="flex gap-2 shrink-0 flex-wrap">
                    <button onClick={()=>{ setEditClassId(isEditing?null:c.id); setAddStudentIds([])}} className="bg-zinc-800 text-white px-3 py-2 rounded-full text-xs font-bold">{isEditing?'Close':'Add Students'}</button>
                    <select value={c.faculty_id||''} onChange={async(e)=>{await supabase.from('classes').update({faculty_id:e.target.value||null}).eq('id',c.id); load()}} className="bg-zinc-800 border border-white/10 p-2 rounded-xl text-xs text-white"><option value="">No Faculty</option>{facultyList.map(f=><option key={f.id} value={f.id}>{f.email}</option>)}</select>
                    <button onClick={async()=>{if(!confirm('Delete class?'))return; await supabase.from('enrollments').delete().eq('class_id',c.id); await supabase.from('classes').delete().eq('id',c.id); load()}} className="bg-red-500/20 text-red-400 px-3 py-2 rounded-full text-xs">Delete</button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">{students.map(s=><span key={s.id} className="bg-black/50 border border-white/10 px-2.5 py-1 rounded-full text-[11px] text-white flex items-center gap-1.5">{s.email}<button onClick={()=>removeStudentFromClass(c.id,s.id)} className="text-red-400 font-bold ml-1">×</button></span>)}{students.length===0&&<span className="text-xs text-zinc-500">No students yet</span>}</div>
                {isEditing && (
                  <div className="mt-4 bg-black/40 border border-white/5 rounded-2xl p-3">
                    <p className="text-xs text-zinc-400 mb-2">Only students not enrolled yet:</p>
                    <div className="max-h-[200px] overflow-auto grid grid-cols-1 sm:grid-cols-2 gap-2">{users.filter(u=>(u.role||'').toLowerCase()==='student' &&!enrollments.some(e=>e.student_id===u.id && e.class_id===c.id)).map(s=>{const checked=addStudentIds.includes(s.id); return <label key={s.id} className={`flex items-center gap-2 p-2 rounded-xl cursor-pointer border ${checked?'bg-orange-600/20 border-orange-500/30':'bg-zinc-800/50 border-white/5'}`}><input type="checkbox" checked={checked} onChange={()=>setAddStudentIds(prev=> prev.includes(s.id)? prev.filter(x=>x!==s.id) : [...prev, s.id])}/><span className="text-xs text-white truncate">{s.email}</span></label>})}</div>
                    <button onClick={()=>addStudentsToClass(c.id)} className="mt-3 w-full bg-white text-black py-2.5 rounded-xl text-xs font-black">Add {addStudentIds.length} Selected to Class</button>
                  </div>
                )}
              </div>
            )
          })}</div>
        </div>
      )}
      {tab==="users" && (<div className="bg-zinc-900/70 border border-white/10 rounded-[24px] p-6"><p className="text-white font-black">All Users ({users.length})</p><p className="text-xs text-zinc-500 mt-2">V2 now reads students from enrollments table, not users.class_id</p></div>)}
      {tab==="approvals" && (<div className="bg-zinc-900/70 border border-white/10 rounded-[24px] p-6"><div className="grid gap-3">{users.filter(u=>!u.is_active).map(u=>(<div key={u.id} className="bg-black/40 border border-white/5 p-4 rounded-2xl flex justify-between"><p className="font-bold text-white">{u.email}</p><button onClick={async()=>{await supabase.from('users').update({is_active:true}).eq('id',u.id); load()}} className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold">Approve</button></div>))}</div></div>)}
    </div>
  )
}

function FacultyDash({profile}){
  const [classes,setClasses]=useState([]); const [users,setUsers]=useState([]); const [enrollments,setEnrollments]=useState([])
  const [assignments,setAssignments]=useState([]); const [subs,setSubs]=useState([])
  const [tab,setTab]=useState("attendance") // CHANGED TO ATTENDANCE FIRST
  const [form,setForm]=useState({title:"",course:"",due_date:"",class_id:"",file:null})
  const [uploading,setUploading]=useState(false)
  const [grades,setGrades]=useState({}); const [feedbacks,setFeedbacks]=useState({})

  const load=async()=>{
    const cRes=await supabase.from('classes').select('*').eq('faculty_id', profile.id); if(cRes.data) setClasses(cRes.data)
    const myClassIds=(cRes.data||[]).map(c=>c.id)
    if(myClassIds.length>0){
      const eRes=await supabase.from('enrollments').select('*').in('class_id', myClassIds); if(eRes.data) setEnrollments(eRes.data)
      const studentIds=(eRes.data||[]).map(e=>e.student_id)
      if(studentIds.length>0){
        const uRes=await supabase.from('users').select('*').in('id', studentIds); if(uRes.data) setUsers(uRes.data)
      }
    }
    const aRes=await supabase.from('assignments').select('*').eq('created_by', profile.id).order('created_at',{ascending:false}); if(aRes.data) setAssignments(aRes.data)
    if(myClassIds.length>0){
      const aAll=await supabase.from('assignments').select('*').in('class_id', myClassIds)
      const allAssignmentIds=[...(aRes.data||[]).map(a=>a.id),...(aAll.data||[]).map(a=>a.id)]
      if(allAssignmentIds.length>0){
        const sRes=await supabase.from('submissions').select('*').in('assignment_id', allAssignmentIds)
        if(sRes.data){
          const allUsers=await supabase.from('users').select('*')
          const allAssignments=await supabase.from('assignments').select('*')
          const enriched=sRes.data.map(sub=>{
            const stu=(allUsers.data||[]).find(u=>u.id===sub.student_id)
            const ass=(allAssignments.data||[]).find(a=>a.id===sub.assignment_id)
            return {...sub,_student:stu,_assignment:ass}
          })
          setSubs(enriched)
        }
      }
    }
  }
  useEffect(()=>{load()},[])

  const myClasses=classes
  const myStudents=users
  const myAssignments=assignments

  const createAssignment=async()=>{
    if(!form.title||!form.due_date) return alert("Title & Due date needed")
    setUploading(true)
    let url=null
    if(form.file){
      const path=Date.now()+"_"+sanitizeInput(form.file.name)
      const up=await supabase.storage.from('mars-files').upload(path,form.file)
      if(up.error){ alert(up.error.message); setUploading(false); return }
      url=supabase.storage.from('mars-files').getPublicUrl(path).data.publicUrl
    }
    const {error}=await supabase.from('assignments').insert({title:sanitizeInput(form.title),course:sanitizeInput(form.course),due_date:form.due_date,class_id:form.class_id||myClasses[0]?.id||null,attachment_url:url,created_by:profile.id})
    if(error) alert(error.message)
    else { setForm({title:"",course:"",due_date:"",class_id:"",file:null}); load() }
    setUploading(false)
  }

  const saveGrade=async(sub)=>{
    const grade=grades[sub.id]!==undefined?grades[sub.id]:sub.grade||""
    const feedback=feedbacks[sub.id]!==undefined?feedbacks[sub.id]:sub.feedback||""
    if(!grade &&!feedback) return alert("Enter grade or comment")
    const {error}=await supabase.from('submissions').update({grade,feedback}).eq('id',sub.id)
    if(error) alert(error.message)
    else { alert("Graded! Student will see it"); load() }
  }

  return (
    <div className="max-w-[1300px] mx-auto space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-900/50 border border-white/10 p-5 rounded-[20px]"><p className="text-[10px] uppercase tracking-widest text-zinc-500">My Classes</p><p className="text-3xl font-black text-white mt-1">{myClasses.length}</p><p className="text-[11px] text-zinc-400 mt-1 truncate">{myClasses.map(c=>c.name).join(', ')||'None'}</p></div>
        <div className="bg-zinc-900/70 border border-white/10 p-5 rounded-[20px]"><p className="text-[10px] uppercase text-zinc-500">My Students (enrollments)</p><p className="text-3xl font-black text-white mt-1">{myStudents.length}</p></div>
        <div className="bg-zinc-900/70 border border-white/10 p-5 rounded-[20px]"><p className="text-[10px] uppercase text-zinc-500">Assignments</p><p className="text-3xl font-black text-white mt-1">{myAssignments.length}</p></div>
        <div className="bg-zinc-900/70 border border-orange-500/20 p-5 rounded-[20px]"><p className="text-[10px] uppercase text-zinc-500">Submissions</p><p className="text-3xl font-black text-orange-400 mt-1">{subs.length}</p></div>
      </div>
      <div className="flex gap-2 bg-zinc-900/80 p-1 rounded-full border border-white/10 overflow-x-auto">
        {[{id:"attendance",l:"📅 Attendance"},{id:"overview",l:"Overview"},{id:"students",l:`My Students (${myStudents.length})`},{id:"create",l:"Create Assignment"},{id:"submissions",l:`Submissions (${subs.length})`}].map(t=>
          <button key={t.id} onClick={()=>setTab(t.id)} className={`px-5 py-2.5 rounded-full text-sm font-bold shrink-0 ${tab===t.id?'bg-orange-600 text-white':'text-zinc-400'}`}>{t.l}</button>
        )}
      </div>
      {tab==="attendance" && <AttendanceModule profile={profile} classes={myClasses} enrollments={enrollments} users={myStudents} />}
      {tab==="overview" && (
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-zinc-900/70 border border-white/10 rounded-[24px] p-6">
              <h3 className="font-black text-white mb-4">My Classes Allocated by Admin (V2)</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {myClasses.map(c=>{
                  const count=enrollments.filter(e=>e.class_id===c.id).length
                  return <div key={c.id} className="bg-black/40 border border-white/5 p-4 rounded-2xl"><p className="font-black text-white">{c.name}</p><p className="text-xs text-zinc-500 mt-1">{count} students via enrollments</p></div>
                })}
                {myClasses.length===0 && <p className="text-sm text-zinc-500">No class allocated yet. Admin will allocate you.</p>}
              </div>
            </div>
            <div className="bg-zinc-900/70 border border-white/10 rounded-[24px] p-6">
              <h3 className="font-black text-white mb-3">Recent Assignments</h3>
              <div className="space-y-2">{myAssignments.slice(0,5).map(a=><div key={a.id} className="bg-black/40 p-3 rounded-xl flex justify-between"><div><p className="font-bold text-sm text-white">{a.title}</p><p className="text-[11px] text-zinc-500">{a.course} • Due {new Date(a.due_date).toLocaleDateString()}</p></div><span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-1 rounded-full h-fit">{myClasses.find(c=>c.id===a.class_id)?.name||'All'}</span></div>)}</div>
            </div>
          </div>
          <div className="bg-zinc-900/70 border border-white/10 rounded-[24px] p-6 h-fit">
            <h3 className="font-black text-white mb-4">Quick Create</h3>
            <div className="space-y-3">
              <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Assignment title" className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white placeholder:text-zinc-500"/>
              <input value={form.course} onChange={e=>setForm({...form,course:e.target.value})} placeholder="Course / Subject" className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white placeholder:text-zinc-500"/>
              <select value={form.class_id} onChange={e=>setForm({...form,class_id:e.target.value})} className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white"><option value="">Select Class</option>{myClasses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <input type="datetime-local" value={form.due_date} onChange={e=>setForm({...form,due_date:e.target.value})} className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white"/>
              <input type="file" onChange={e=>setForm({...form,file:e.target.files[0]})} className="w-full text-sm file:bg-orange-600 file:text-white file:border-0 file:px-4 file:py-2 file:rounded-xl bg-zinc-800 border border-white/10 p-2 rounded-2xl text-white"/>
              <button disabled={uploading} onClick={createAssignment} className="w-full bg-orange-600 py-3.5 rounded-2xl font-black text-white">{uploading?'Publishing...':'Publish Assignment'}</button>
            </div>
          </div>
        </div>
      )}
      {tab==="students" && (
        <div className="bg-zinc-900/70 border border-white/10 rounded-[24px] p-6">
          <div className="flex justify-between items-center mb-4"><h3 className="font-black text-white text-lg">Students Allocated to Me (via enrollments)</h3><button onClick={()=>{const rows=myStudents.map(s=>({Email:s.email,Name:s.full_name,Class:myClasses.find(c=>enrollments.find(e=>e.class_id===c.id && e.student_id===s.id))?.name||'',Status:s.is_active?'Active':'Pending'})); const ws=XLSX.utils.json_to_sheet(rows); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"MyStudents"); XLSX.writeFile(wb,`My-Students-V2-${new Date().toISOString().slice(0,10)}.xlsx`)}} className="bg-white text-black px-4 py-2 rounded-full text-xs font-black">Export My Students</button></div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">{myStudents.map(s=><div key={s.id} className="bg-black/40 border border-white/5 p-4 rounded-2xl flex gap-3 items-center"><div className="w-10 h-10 bg-orange-600/20 rounded-full flex items-center justify-center font-black text-orange-400">{s.full_name?.[0]||s.email[0].toUpperCase()}</div><div className="min-w-0"><p className="font-bold text-sm text-white truncate">{s.full_name||s.email}</p><p className="text-[11px] text-zinc-500 truncate">{s.email}</p><span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full mt-1 inline-block">{myClasses.find(c=>enrollments.some(e=>e.class_id===c.id && e.student_id===s.id))?.name||'No Class'}</span></div></div>)}{myStudents.length===0 && <p className="text-zinc-500 text-sm col-span-3">No students allocated yet - admin must enroll students via enrollments.</p>}</div>
        </div>
      )}
      {tab==="create" && (
        <div className="max-w-[600px] mx-auto bg-zinc-900/70 border border-orange-500/20 p-6 rounded-[24px]">
          <h3 className="font-black text-white text-xl mb-4">Create Assignment for My Classes</h3>
          <div className="space-y-3">
            <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Title e.g Chapter 1 Homework" className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white"/>
            <div className="grid grid-cols-2 gap-3"><input value={form.course} onChange={e=>setForm({...form,course:e.target.value})} placeholder="Course" className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white"/><select value={form.class_id} onChange={e=>setForm({...form,class_id:e.target.value})} className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white"><option value="">All My Classes</option>{myClasses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <input type="datetime-local" value={form.due_date} onChange={e=>setForm({...form,due_date:e.target.value})} className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white"/>
            <input type="file" onChange={e=>setForm({...form,file:e.target.files[0]})} className="w-full text-sm file:bg-orange-600 file:text-white file:border-0 file:px-4 file:py-2 file:rounded-xl bg-zinc-800 border border-white/10 p-2 rounded-2xl text-white"/>
            <button disabled={uploading} onClick={createAssignment} className="w-full bg-orange-600 py-3.5 rounded-2xl font-black text-white">{uploading?'Publishing...':'Publish'}</button>
          </div>
        </div>
      )}
      {tab==="submissions" && (
        <div className="bg-zinc-900/70 border border-white/10 rounded-[24px] p-6">
          <h3 className="font-black text-white text-lg mb-4">Submissions Received ({subs.length}) - Grade + Comment</h3>
          <div className="grid lg:grid-cols-2 gap-4">
            {subs.map(s=>(
              <div key={s.id} className="bg-black/60 border border-white/5 p-4 rounded-2xl">
                <div className="flex justify-between items-start gap-2"><div><p className="font-bold text-white text-sm">{s._student?.full_name||s._student?.email||s.student_id.slice(0,8)}</p><p className="text-[11px] text-zinc-500">{s._student?.email}</p><p className="text-xs text-orange-400 mt-1">{s._assignment?.title||'Assignment'} - {s._assignment?.course||''}</p></div><span className={`text-[10px] px-2 py-1 rounded-full h-fit ${s.grade?'bg-green-500/20 text-green-400':'bg-orange-500/20 text-orange-400'}`}>{s.grade?`Graded: ${s.grade}`:'Needs Grading'}</span></div>
                <a href={s.file_url} target="_blank" rel="noreferrer" className="inline-block mt-3 bg-zinc-800 text-white px-3 py-2 rounded-xl text-xs">📄 View Submitted File</a>
                <div className="mt-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input value={grades[s.id]!==undefined?grades[s.id]:s.grade||''} onChange={e=>setGrades({...grades,[s.id]:e.target.value})} placeholder="Grade e.g A, 85%" className="bg-zinc-800 border border-white/10 p-2.5 rounded-xl text-sm text-white"/>
                    <button onClick={()=>saveGrade(s)} className="bg-orange-600 text-white px-3 py-2.5 rounded-xl text-xs font-black">Save Grade + Comment</button>
                  </div>
                  <textarea value={feedbacks[s.id]!==undefined?feedbacks[s.id]:s.feedback||''} onChange={e=>setFeedbacks({...feedbacks,[s.id]:e.target.value})} placeholder="Write feedback / comment for student..." rows={3} className="w-full bg-zinc-800 border border-white/10 p-2.5 rounded-xl text-sm text-white placeholder:text-zinc-500"></textarea>
                  {s.feedback && <p className="text-[11px] text-zinc-400 bg-white/5 p-2 rounded-xl">Current comment: {s.feedback}</p>}
                </div>
              </div>
            ))}
            {subs.length===0 && <p className="text-zinc-500 col-span-2 text-center py-10">No submissions yet.</p>}
          </div>
        </div>
      )}
    </div>
  )
}

function StudentDash({profile}){
  const [assignments,setAssignments]=useState([]); const [mySubs,setMySubs]=useState([]); const [myClass,setMyClass]=useState(null); const [myFaculty,setMyFaculty]=useState(null); const [enrollment,setEnrollment]=useState(null)
  useEffect(()=>{(async()=>{
    const {data:enroll}=await supabase.from('enrollments').select('*').eq('student_id', profile.id).eq('status','active').order('created_at',{ascending:false}).limit(1).single()
    if(enroll){
      setEnrollment(enroll)
      const cls=await supabase.from('classes').select('*').eq('id',enroll.class_id).single(); if(cls.data) setMyClass(cls.data)
      if(cls.data?.faculty_id){ const fac=await supabase.from('users').select('*').eq('id',cls.data.faculty_id).single(); if(fac.data) setMyFaculty(fac.data) }
      const a=await supabase.from('assignments').select('*').or(`class_id.eq.${enroll.class_id},class_id.is.null`).order('due_date',{ascending:true}); if(a.data) setAssignments(a.data)
    } else {
      if(profile.class_id){
        const cls=await supabase.from('classes').select('*').eq('id',profile.class_id).single(); if(cls.data) setMyClass(cls.data)
        const a=await supabase.from('assignments').select('*').or(`class_id.eq.${profile.class_id},class_id.is.null`).order('due_date',{ascending:true}); if(a.data) setAssignments(a.data)
      }
    }
    const s=await supabase.from('submissions').select('*').eq('student_id',profile.id); if(s.data) setMySubs(s.data)
  })()},[profile])

  const submitWork=async(assignmentId,file)=>{
    if(!file) return
    const path=profile.id+"/"+Date.now()+"_"+sanitizeInput(file.name)
    const up=await supabase.storage.from('mars-files').upload(path,file)
    if(up.error) return alert(up.error.message)
    const url=supabase.storage.from('mars-files').getPublicUrl(path).data.publicUrl
    await supabase.from('submissions').insert({assignment_id:assignmentId,student_id:profile.id,file_url:url,status:'submitted'})
    alert("Submitted!")
    const s=await supabase.from('submissions').select('*').eq('student_id',profile.id); if(s.data) setMySubs(s.data)
  }

  return (
    <div className="max-w-[1100px] mx-auto space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-zinc-900/70 border border-white/10 p-5 rounded-[20px]"><p className="text-[10px] uppercase text-zinc-500">My Class (via enrollments)</p><p className="text-xl font-black text-white mt-1">{myClass?.name||'Not assigned'}</p><p className="text-xs text-zinc-400 mt-1">Faculty: {myFaculty?.full_name||myFaculty?.email||'None'}</p><p className="text-[10px] text-zinc-600 mt-1">Enrolled: {enrollment?.created_at? new Date(enrollment.created_at).toLocaleDateString() : '-'}</p></div>
        <div className="bg-zinc-900/70 border border-white/10 p-5 rounded-[20px]"><p className="text-[10px] uppercase text-zinc-500">Pending</p><p className="text-3xl font-black text-orange-400 mt-1">{assignments.filter(a=>!mySubs.find(s=>s.assignment_id===a.id)).length}</p></div>
        <div className="bg-zinc-900/70 border border-white/10 p-5 rounded-[20px]"><p className="text-[10px] uppercase text-zinc-500">Submitted</p><p className="text-3xl font-black text-green-400 mt-1">{mySubs.length}</p></div>
      </div>

      {/* NEW STUDENT ATTENDANCE */}
      <StudentAttendanceView profile={profile} />

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-3">
          {assignments.map(a=>{
            const sub=mySubs.find(s=>s.assignment_id===a.id)
            const isExpired=a.due_date&&new Date(a.due_date)<new Date()
            return (
              <div key={a.id} className={`p-4 rounded-[20px] border ${isExpired&&!sub?'bg-red-500/10 border-red-500/20': sub?'bg-green-500/5 border-green-500/20':'bg-zinc-900/70 border-white/10'}`}>
                <div className="flex justify-between gap-2">
                  <div><p className="font-black text-white">{a.title}</p><p className="text-xs text-zinc-400">{a.course} • {myClass?.name||'All Classes'}</p><p className="text-[11px] text-zinc-500 mt-1">Due: {a.due_date?new Date(a.due_date).toLocaleString():'No due'} {isExpired&&<span className="text-red-400 font-bold">• EXPIRED</span>}</p></div>
                  {sub? <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs h-fit font-bold">{sub.grade?`Grade: ${sub.grade}`:'Submitted ✓'}</span> : <span className="bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-xs h-fit">Pending</span>}
                </div>
                {sub?.feedback && <div className="mt-3 bg-orange-500/10 border border-orange-500/20 p-3 rounded-xl"><p className="text-[11px] text-orange-300 font-bold">Teacher Comment:</p><p className="text-sm text-white mt-1">{sub.feedback}</p></div>}
                {a.attachment_url&&<a href={a.attachment_url} target="_blank" rel="noreferrer" className="inline-block mt-2 text-orange-400 text-xs underline">📎 Download Assignment File</a>}
                <div className="mt-3 flex gap-2 items-center">
                  <label className="flex-1 bg-zinc-800 border border-white/10 px-3 py-2.5 rounded-xl text-xs text-white cursor-pointer text-center"> {sub?'Resubmit Work':'Upload Work'} <input type="file" hidden onChange={e=>submitWork(a.id,e.target.files[0])}/></label>
                  {sub&&<a href={sub.file_url} target="_blank" rel="noreferrer" className="bg-white text-black px-3 py-2 rounded-xl text-xs font-bold">View My Submission</a>}
                </div>
              </div>
            )
          })}
        </div>
        <div className="space-y-4">
          <div className="bg-zinc-900/70 border border-white/10 rounded-[24px] p-5">
            <h4 className="font-black text-white mb-3">My Grades</h4>
            <div className="space-y-2">{mySubs.filter(s=>s.grade).map(s=><div key={s.id} className="bg-black/40 p-3 rounded-xl flex justify-between"><p className="text-sm text-white truncate">{assignments.find(a=>a.id===s.assignment_id)?.title||'Assignment'}</p><span className="text-sm font-black text-green-400">{s.grade}</span></div>)}{mySubs.filter(s=>s.grade).length===0 && <p className="text-xs text-zinc-500">No grades yet</p>}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ParentDash({profile}){
  const [child,setChild]=useState(null); const [childClass,setChildClass]=useState(null); const [childGrades,setChildGrades]=useState([]); const [childAtt,setChildAtt]=useState([])
  useEffect(()=>{(async()=>{
    if(profile.linked_student_id){
      const d=await supabase.from('users').select('*').eq('id',profile.linked_student_id).single(); if(d.data) setChild(d.data)
      const enroll=await supabase.from('enrollments').select('*').eq('student_id', profile.linked_student_id).single(); if(enroll.data){ const c=await supabase.from('classes').select('*').eq('id', enroll.data.class_id).single(); if(c.data) setChildClass(c.data) }
      const subs=await supabase.from('submissions').select('*').eq('student_id', profile.linked_student_id); if(subs.data) setChildGrades(subs.data)
      const att=await supabase.from('attendance').select('*').eq('student_id', profile.linked_student_id).order('date',{ascending:false}).limit(20); if(att.data) setChildAtt(att.data)
    }
  })()},[profile]);
  const rate = childAtt.length? Math.round(childAtt.filter(a=>a.status==='present').length/childAtt.length*100) : 0
  return <div className="max-w-[800px] mx-auto space-y-4"><h2 className="text-xl font-black text-white">Parent View V2</h2><div className="bg-zinc-900/70 border border-white/10 rounded-[24px] p-6 space-y-3"><p className="text-zinc-400">Child: {child?child.email:"Not linked"}</p><p className="text-zinc-400">Class (via enrollments): {childClass?.name||'N/A'}</p><p className="text-zinc-400">Submissions: {childGrades.length}</p><div className="pt-3 border-t border-white/10"><p className="text-white font-bold">Attendance: {rate}% ({childAtt.filter(a=>a.status==='present').length}/{childAtt.length} days)</p><div className="w-full bg-zinc-800 rounded-full h-2 mt-2"><div className="bg-green-500 h-2 rounded-full" style={{width:`${rate}%`}}></div></div></div></div></div>
}

export default AppWrapper