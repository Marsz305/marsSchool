import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

async function logAccess(user){
  try {
    await supabase.from('access_logs').insert({
      user_id: user.id, email: user.email,
      role: user.user_metadata?.role, device: navigator.userAgent
    })
    await supabase.from('audit_logs').insert({
      user_id: user.id, action: `LOGIN - ${user.email}`, table_name: 'auth'
    })
  } catch {}
}

function Countdown({ due }){
  const [left, setLeft] = useState("")
  useEffect(()=>{
    const t = setInterval(()=>{
      const diff = new Date(due) - new Date()
      if(diff<=0){ setLeft("CLOSED"); return }
      const h=Math.floor(diff/3600000), m=Math.floor((diff%3600000)/60000)
      setLeft(`${h}h ${m}m left`)
    },1000)
    return ()=>clearInterval(t)
  },[due])
  return <span className={(new Date(due)-new Date())<86400000?"text-red-400":"text-orange-400"}>{left}</span>
}

// --- SHARED NAV ---
function Nav({ role, active, setActive, onLogout, unread }){
  const menus = {
    super_admin: ["Dashboard","Students","Classes","Teachers","Attendance","Assignments","Exams","Fees","Announcements","Audit Logs","Users"],
    school_admin: ["Dashboard","Students","Classes","Teachers","Attendance","Assignments","Exams","Fees","Announcements","Users"],
    teacher: ["Dashboard","My Classes","Attendance","Assignments","Exams","Students"],
    student: ["Dashboard","My Assignments","My Results","My Fees","Timetable","Announcements"],
    parent: ["Dashboard","My Children","Fees","Attendance","Results","Announcements"],
    finance: ["Dashboard","Fees","Invoices","Reports","Students"],
    registrar: ["Dashboard","Students","Classes","Admissions","Documents"],
    faculty: ["Dashboard","My Classes","Attendance","Assignments","Exams","Students"]
  }
  const items = menus[role] || menus.student
  return (
    <div className="w-full md:w-64 bg-zinc-900 border-r border-orange-500/20 p-4 md:min-h-screen">
      <h1 className="text-xl font-bold mb-6"><span className="text-orange-500">MARS</span> e-School</h1>
      <div className="space-y-1">
        {items.map(i=>(
          <button key={i} onClick={()=>setActive(i)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${active===i?'bg-orange-600 text-white':'text-zinc-400 hover:bg-zinc-800'}`}>{i} {i==="Announcements" && unread>0 && <span className="bg-red-500 text-white px-1.5 rounded-full text-xs ml-2">{unread}</span>}</button>
        ))}
      </div>
      <button onClick={onLogout} className="mt-8 w-full bg-zinc-800 py-2 rounded text-sm">Logout • {role}</button>
    </div>
  )
}

// --- DASHBOARD ANALYTICS ---
function Dashboard({ stats }){
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900 p-5 rounded-2xl border border-orange-500/20"><p className="text-zinc-500 text-xs">Total Students</p><p className="text-3xl font-bold">{stats.students}</p><p className="text-xs text-green-400 mt-1">+12 this term</p></div>
        <div className="bg-zinc-900 p-5 rounded-2xl border border-orange-500/20"><p className="text-zinc-500 text-xs">Teachers</p><p className="text-3xl font-bold">{stats.teachers}</p></div>
        <div className="bg-zinc-900 p-5 rounded-2xl border border-orange-500/20"><p className="text-zinc-500 text-xs">Attendance Today</p><p className="text-3xl font-bold">{stats.attendance}%</p><div className="w-full bg-zinc-800 h-1.5 rounded mt-2"><div className="bg-orange-500 h-1.5 rounded" style={{width:`${stats.attendance}%`}}></div></div></div>
        <div className="bg-zinc-900 p-5 rounded-2xl border border-orange-500/20"><p className="text-zinc-500 text-xs">Fees Collected</p><p className="text-2xl font-bold">${stats.collected}</p><p className="text-xs text-zinc-500">Outstanding: ${stats.outstanding}</p></div>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900 p-6 rounded-2xl border border-orange-500/20">
          <h3 className="font-bold mb-3">Students by Class</h3>
          {stats.byClass?.map(c=><div key={c.name} className="flex justify-between py-2 text-sm border-b border-zinc-800"><span>{c.name}</span><span className="text-orange-400">{c.count}</span></div>)}
        </div>
        <div className="bg-zinc-900 p-6 rounded-2xl border border-orange-500/20">
          <h3 className="font-bold mb-3">Recent Activity (Audit Log)</h3>
          {stats.audit?.slice(0,5).map(a=><div key={a.id} className="text-xs py-2 border-b border-zinc-800"><span className="text-zinc-500">{new Date(a.created_at).toLocaleString()}</span> - {a.action}</div>)}
        </div>
      </div>
    </div>
  )
}

// --- STUDENT MANAGEMENT ---
function StudentsModule(){
  const [students,setStudents]=useState([]), [classes,setClasses]=useState([])
  const [form,setForm]=useState({first_name:"",last_name:"",admission_number:"",class_id:"",contact:""})

  useEffect(()=>{
    supabase.from('students').select('*, classes(name)').order('created_at',{ascending:false}).then(({data})=>setStudents(data||[]))
    supabase.from('classes').select('*').then(({data})=>setClasses(data||[]))
  },[])

  const createStudent = async()=>{
    if(!form.admission_number ||!form.first_name) return alert("Fill required")
    const {data, error} = await supabase.from('students').insert(form).select()
    if(error) alert(error.message); else { setStudents([...data,...students]); setForm({first_name:"",last_name:"",admission_number:"",class_id:"",contact:""}) }
  }

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 p-6 rounded-2xl border border-orange-500/20">
        <h3 className="font-bold mb-4">Add Student - Full Profile</h3>
        <div className="grid md:grid-cols-3 gap-3">
          <input value={form.first_name} onChange={e=>setForm({...form,first_name:e.target.value})} placeholder="First Name" className="bg-zinc-800 p-3 rounded"/>
          <input value={form.last_name} onChange={e=>setForm({...form,last_name:e.target.value})} placeholder="Last Name" className="bg-zinc-800 p-3 rounded"/>
          <input value={form.admission_number} onChange={e=>setForm({...form,admission_number:e.target.value})} placeholder="Admission No e.g STU2026/001" className="bg-zinc-800 p-3 rounded"/>
          <select value={form.class_id} onChange={e=>setForm({...form,class_id:e.target.value})} className="bg-zinc-800 p-3 rounded">
            <option value="">Select Class</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input value={form.contact} onChange={e=>setForm({...form,contact:e.target.value})} placeholder="Parent Contact" className="bg-zinc-800 p-3 rounded"/>
          <button onClick={createStudent} className="bg-orange-600 rounded font-bold">Add Student</button>
        </div>
      </div>
      <div className="bg-zinc-900 p-6 rounded-2xl overflow-auto">
        <h3 className="font-bold mb-4">Student Register ({students.length})</h3>
        <table className="w-full text-sm min-w-[700px]">
          <thead className="text-zinc-500"><tr><th className="text-left p-2">Adm No</th><th className="text-left">Name</th><th>Class</th><th>Contact</th><th>Status</th></tr></thead>
          <tbody>{students.map(s=><tr key={s.id} className="border-t border-zinc-800"><td className="p-2">{s.admission_number}</td><td>{s.first_name} {s.last_name}</td><td>{s.classes?.name || '-'}</td><td>{s.contact}</td><td><span className="bg-green-600/20 text-green-400 px-2 py-1 rounded text-xs">{s.status}</span></td></tr>)}</tbody>
        </table>
      </div>
    </div>
  )
}

// --- ATTENDANCE MARKING ---
function AttendanceModule(){
  const [students,setStudents]=useState([]), [classes,setClasses]=useState([]), [classId,setClassId]=useState("")
  const [date,setDate]=useState(new Date().toISOString().slice(0,10))
  useEffect(()=>{ supabase.from('classes').select('*').then(({data})=>setClasses(data||[])) },[])
  useEffect(()=>{
    if(!classId) return
    supabase.from('students').select('*').eq('class_id',classId).then(({data})=>setStudents(data?.map(s=>({...s, status:'present'}))||[]))
  },[classId])

  const mark = (id,status)=> setStudents(students.map(s=>s.id===id?{...s,status}:s))
  const save = async()=>{
    const rows = students.map(s=>({student_id:s.id, class_id:classId, date, status:s.status}))
    const {error} = await supabase.from('attendance').insert(rows)
    if(error) alert(error.message); else alert(`Attendance saved for ${rows.length} students - ${date}`)
  }

  return (
    <div className="bg-zinc-900 p-6 rounded-2xl border border-orange-500/20">
      <h3 className="font-bold mb-4">Attendance - {date}</h3>
      <div className="flex gap-3 mb-4">
        <select value={classId} onChange={e=>setClassId(e.target.value)} className="bg-zinc-800 p-3 rounded"><option value="">Select Class</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="bg-zinc-800 p-3 rounded"/>
        <button onClick={save} className="bg-orange-600 px-6 rounded font-bold">Save Attendance</button>
      </div>
      <div className="space-y-2">{students.map(s=><div key={s.id} className="flex justify-between items-center bg-zinc-800 p-3 rounded"><span>{s.first_name} {s.last_name} • {s.admission_number}</span><div className="flex gap-2">{['present','absent','late','excused'].map(st=><button key={st} onClick={()=>mark(s.id,st)} className={`px-3 py-1 rounded text-xs ${s.status===st?'bg-orange-600':'bg-zinc-700'}`}>{st}</button>)}</div></div>)}</div>
    </div>
  )
}

// --- FEES ---
function FeesModule(){
  const [invoices,setInvoices]=useState([]), [students,setStudents]=useState([])
  useEffect(()=>{
    supabase.from('invoices').select('*, students(first_name,last_name,admission_number)').order('created_at',{ascending:false}).then(({data})=>setInvoices(data||[]))
    supabase.from('students').select('id,first_name,last_name').then(({data})=>setStudents(data||[]))
  },[])

  const [form,setForm]=useState({student_id:"",total_amount:""})
  const createInvoice = async()=>{
    const {data,error}=await supabase.from('invoices').insert({student_id:form.student_id,total_amount:Number(form.total_amount)}).select()
    if(error) alert(error.message); else setInvoices([...data,...invoices])
  }
  const pay = async(inv, amount)=>{
    const {error}=await supabase.from('payments').insert({invoice_id:inv.id, amount:Number(amount), payment_method:'cash', receipt_number:'RCP'+Date.now()})
    if(!error){ await supabase.from('invoices').update({paid_amount: inv.paid_amount + Number(amount)}).eq('id',inv.id); alert("Payment recorded - Receipt generated") }
  }

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="bg-zinc-900 p-6 rounded-2xl"><h3 className="font-bold">Create Invoice</h3><div className="mt-3 space-y-2"><select value={form.student_id} onChange={e=>setForm({...form,student_id:e.target.value})} className="w-full bg-zinc-800 p-3 rounded"><option value="">Student</option>{students.map(s=><option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}</select><input value={form.total_amount} onChange={e=>setForm({...form,total_amount:e.target.value})} placeholder="Amount e.g 600" className="w-full bg-zinc-800 p-3 rounded"/><button onClick={createInvoice} className="w-full bg-orange-600 py-2 rounded font-bold">Create Invoice</button></div></div>
        <div className="lg:col-span-2 bg-zinc-900 p-6 rounded-2xl">
          <h3 className="font-bold mb-3">Invoices - Balance Auto-Calculated</h3>
          {invoices.map(inv=><div key={inv.id} className="flex justify-between py-3 border-b border-zinc-800 text-sm"><span>{inv.students?.first_name} • ${inv.total_amount} • Paid ${inv.paid_amount} • <b className="text-orange-400">Bal ${inv.balance}</b></span><button onClick={()=>{const a=prompt("Enter amount paid"); if(a) pay(inv,a)}} className="bg-zinc-800 px-3 py-1 rounded">Record Payment</button></div>)}
        </div>
      </div>
    </div>
  )
}

// --- EXAMS ---
function ExamsModule(){
  const [exams,setExams]=useState([]), [results,setResults]=useState([])
  useEffect(()=>{ supabase.from('exams').select('*').then(({data})=>setExams(data||[])); supabase.from('exam_results').select('*, students(first_name,last_name), subjects(name)').then(({data})=>setResults(data||[])) },[])
  const [form,setForm]=useState({name:"",exam_type:"Term Test"})
  const createExam=async()=>{ const {data}=await supabase.from('exams').insert(form).select(); if(data) setExams([...data,...exams]) }

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 p-6 rounded-2xl border border-orange-500/20">
        <h3 className="font-bold mb-3">Create Exam + Auto-Grading</h3>
        <div className="flex gap-3"><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g Term 3 Final 2026" className="flex-1 bg-zinc-800 p-3 rounded"/><button onClick={createExam} className="bg-orange-600 px-6 rounded font-bold">Create</button></div>
        <div className="mt-4 grid md:grid-cols-3 gap-2 text-xs">{exams.map(ex=><div key={ex.id} className="bg-zinc-800 p-3 rounded">{ex.name} • {ex.exam_type} • {ex.is_published?'Published':'Draft'}</div>)}</div>
      </div>
      <div className="bg-zinc-900 p-6 rounded-2xl">
        <h3 className="font-bold mb-3">Results - Auto Average & Grade</h3>
        <table className="w-full text-sm"><thead className="text-zinc-500"><tr><th className="text-left">Student</th><th>Subject</th><th>Marks</th><th>Grade</th></tr></thead><tbody>{results.map(r=><tr key={r.id} className="border-t border-zinc-800"><td>{r.students?.first_name} {r.students?.last_name}</td><td>{r.subjects?.name}</td><td>{r.marks}</td><td>{r.marks>=80?'A':r.marks>=60?'B':r.marks>=50?'C':'F'}</td></tr>)}</tbody></table>
      </div>
    </div>
  )
}

// --- ORIGINAL DASHES (kept) ---
function StudentDash({ assignments }){
  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="bg-zinc-900 p-6 rounded-2xl border border-orange-500/20"><h3 className="text-orange-400 font-bold">My Courses</h3><div className="mt-4 space-y-4"><div><p>PHYS 220 • Physics of Mars</p><div className="w-full bg-zinc-800 h-2 rounded mt-1"><div className="bg-orange-500 h-2 w-[67%] rounded"></div></div></div></div></div>
      <div className="bg-zinc-900 p-6 rounded-2xl border border-orange-500/20"><h3 className="font-bold">School Fees Balance</h3><p className="text-4xl font-bold mt-2">$1,250.00</p><p className="text-xs text-zinc-400">Outstanding • Due: 30 Oct 2026</p></div>
      <div className="lg:col-span-3 bg-zinc-900 p-6 rounded-2xl border border-orange-500/20"><h3 className="font-bold mb-3">Assignments - Time Sensitive</h3>{assignments.map(a=><div key={a.id} className="flex justify-between py-3 border-b border-zinc-800 text-sm"><span>{a.title}</span><span><Countdown due={a.due_date}/></span></div>)}</div>
    </div>
  )
}
function FacultyDash({ assignments, setAssignments }){
  const [title,setTitle]=useState(""), [due,setDue]=useState("")
  const addAssignment=async()=>{
    if(!title||!due) return alert("Fill all")
    const {data} = await supabase.from('assignments').insert({title, course:"PHYS 220", due_date:due, max_marks:100}).select()
    if(data) setAssignments([...assignments,...data]); setTitle(""); setDue("")
  }
  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 p-6 rounded-2xl"><h2 className="text-xl font-bold mb-4">Create Assignment</h2><div className="flex gap-3"><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Title" className="flex-1 bg-zinc-800 p-3 rounded"/><input type="datetime-local" value={due} onChange={e=>setDue(e.target.value)} className="bg-zinc-800 p-3 rounded"/><button onClick={addAssignment} className="bg-orange-600 px-6 rounded font-bold">Publish</button></div></div>
    </div>
  )
}

// --- MAIN APP ---
export default function App(){
  const [user,setUser]=useState(null), [profile,setProfile]=useState(null)
  const [assignments,setAssignments]=useState([]), [active,setActive]=useState("Dashboard")
  const [stats,setStats]=useState({students:0,teachers:0,attendance:94.2,collected:0,outstanding:0,byClass:[],audit:[]})
  const [unread,setUnread]=useState(0)

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{ if(data.session) setUser(data.session.user) })
    supabase.auth.onAuthStateChange((e,session)=>{ if(session?.user){ setUser(session.user); logAccess(session.user) } else { setUser(null); setProfile(null) } })
    supabase.from('assignments').select('*').order('due_date').then(({data})=>{ if(data) setAssignments(data) })
  },[])

  useEffect(()=>{
    if(!user) return
    supabase.from('profiles').select('*').eq('id',user.id).single().then(({data})=>{
      if(data){ setProfile(data); setActive("Dashboard") }
      else {
        const role = user.user_metadata?.role || 'student'
        supabase.from('profiles').insert({id:user.id,email:user.email,role,full_name:user.user_metadata?.full_name}).then(()=>setProfile({role}))
      }
    })
    // load stats
    const loadStats = async()=>{
      const [{count:sc},{count:tc}, {data:inv}, {data:aud}] = await Promise.all([
        supabase.from('students').select('*',{count:'exact',head:true}),
        supabase.from('profiles').select('*',{count:'exact',head:true}).eq('role','teacher'),
        supabase.from('invoices').select('total_amount,paid_amount'),
        supabase.from('audit_logs').select('*').order('created_at',{ascending:false}).limit(10)
      ])
      const collected = inv?.reduce((s,i)=>s+Number(i.paid_amount),0)||0
      const total = inv?.reduce((s,i)=>s+Number(i.total_amount),0)||0
      const {data:cls}=await supabase.from('classes').select('id,name')
      let byClass=[]
      if(cls){ for(let c of cls){ const {count}=await supabase.from('students').select('*',{count:'exact',head:true}).eq('class_id',c.id); byClass.push({name:c.name,count:count||0}) } }
      setStats({students:sc||0,teachers:tc||0,attendance:94.2,collected, outstanding: total-collected, byClass, audit:aud||[]})
    }
    loadStats()
  },[user])

  const handleLogin=async(e)=>{
    e.preventDefault()
    const {data,error}=await supabase.auth.signInWithPassword({email:e.target.email.value, password:e.target.password.value})
    if(error) alert(error.message)
  }
  const handleSignup=async(e)=>{
    e.preventDefault()
    const email=e.target.email.value, password=e.target.password.value, full_name=e.target.fullname.value, role=e.target.role.value
    const {data,error}=await supabase.auth.signUp({email,password,options:{data:{full_name, role}}})
    if(error){ alert(error.message); return }
    alert("Account created! Login now. If it says confirm email, go to Supabase -> Auth -> Providers -> Email -> OFF Confirm Email")
  }

  if(!user){
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-zinc-900 p-8 rounded-2xl w-full max-w-md border border-orange-500/20">
          <h1 className="text-3xl font-bold mb-6"><span className="text-orange-500">MARS</span> E-School</h1>
          <form onSubmit={handleLogin} className="space-y-3">
            <input name="email" placeholder="Email" className="w-full bg-zinc-800 p-3 rounded" required/>
            <input name="password" type="password" placeholder="Password" className="w-full bg-zinc-800 p-3 rounded" required/>
            <button className="w-full bg-orange-600 p-3 rounded font-bold">LOGIN</button>
          </form>
          <details className="mt-6"><summary className="text-zinc-400 text-sm cursor-pointer">Create new account</summary>
            <form onSubmit={handleSignup} className="mt-3 space-y-2">
              <input name="fullname" placeholder="Full Name" className="w-full bg-zinc-800 p-2 rounded" required/>
              <input name="email" placeholder="Email" className="w-full bg-zinc-800 p-2 rounded" required/>
              <input name="password" type="password" placeholder="Password" className="w-full bg-zinc-800 p-2 rounded" required/>
              <select name="role" className="w-full bg-zinc-800 p-2 rounded"><option value="student">Student</option><option value="teacher">Teacher</option><option value="parent">Parent</option><option value="school_admin">School Admin</option><option value="finance">Finance</option><option value="registrar">Registrar</option><option value="super_admin">Super Admin</option></select>
              <button className="w-full bg-zinc-700 p-2 rounded mt-2">Sign Up</button>
            </form>
          </details>
        </div>
      </div>
    )
  }

  const role = profile?.role || user.user_metadata?.role || 'student'

  const renderModule = ()=>{
    if(active==="Dashboard") return <Dashboard stats={stats}/>
    if(active==="Students" || active==="My Children") return <StudentsModule/>
    if(active==="Attendance") return <AttendanceModule/>
    if(active==="Fees" || active==="Invoices") return <FeesModule/>
    if(active==="Exams" || active==="My Results" || active==="Results") return <ExamsModule/>
    if(active==="Assignments" || active==="My Assignments") return <StudentDash assignments={assignments}/>
    if(role==='teacher' || role==='faculty') return <FacultyDash assignments={assignments} setAssignments={setAssignments}/>
    return <Dashboard stats={stats}/>
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col md:flex-row">
      <Nav role={role} active={active} setActive={setActive} unread={unread} onLogout={()=>supabase.auth.signOut()}/>
      <div className="flex-1 p-4 md:p-8 overflow-auto">
        <header className="flex justify-between mb-6"><h2 className="text-xl font-bold">{active} • {user.email} • {role}</h2></header>
        {renderModule()}
      </div>
    </div>
  )
}