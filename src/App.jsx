import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

async function logAccess(user){
  try{ await supabase.from('access_logs').insert({user_id:user.id,email:user.email,role:user.user_metadata?.role,device:navigator.userAgent}) }catch{}
}

// --- ADMIN DASHBOARD - FULL POWER ---
function AdminDash(){
  const [users,setUsers]=useState([]), [students,setStudents]=useState([])
  const [assignments,setAssignments]=useState([]), [exams,setExams]=useState([])
  const [classes,setClasses]=useState([]), [logs,setLogs]=useState([])
  const [tab,setTab]=useState("overview")

  // Forms
  const [studForm,setStudForm]=useState({first_name:"",last_name:"",admission_number:"",class_id:""})
  const [assignForm,setAssignForm]=useState({title:"",course:"General",due_date:"",max_marks:100, file:null})
  const [examForm,setExamForm]=useState({name:"",exam_type:"Term Test"})
  const [uploadProgress,setUploadProgress]=useState("")

  const loadAll = async()=>{
    const {data:u}=await supabase.from('profiles').select('*').order('created_at',{ascending:false})
    const {data:s}=await supabase.from('students').select('*, classes(name)').order('created_at',{ascending:false})
    const {data:a}=await supabase.from('assignments').select('*').order('created_at',{ascending:false}).limit(20)
    const {data:e}=await supabase.from('exams').select('*').order('created_at',{ascending:false}).limit(20)
    const {data:c}=await supabase.from('classes').select('*')
    const {data:l}=await supabase.from('access_logs').select('*').order('login_time',{ascending:false}).limit(50)
    if(u) setUsers(u); if(s) setStudents(s); if(a) setAssignments(a); if(e) setExams(e); if(c) setClasses(c); if(l) setLogs(l)
  }
  useEffect(()=>{ loadAll() },[])

  // 1. ADD NEW STUDENT
  const addStudent = async()=>{
    if(!studForm.admission_number) return alert("Admission No required")
    const {data,error}=await supabase.from('students').insert(studForm).select()
    if(error) alert(error.message); else { setStudents([...data,...students]); setStudForm({first_name:"",last_name:"",admission_number:"",class_id:""}); alert("Student added!") }
  }

  // 2. ADD NEW ASSIGNMENT + FILE UPLOAD
  const addAssignment = async()=>{
    if(!assignForm.title ||!assignForm.due_date) return alert("Title & Due date required")
    let fileUrl = null
    if(assignForm.file){
      setUploadProgress("Uploading file...")
      const path = `${Date.now()}_${assignForm.file.name}`
      const {error:upErr}=await supabase.storage.from('mars-files').upload(path, assignForm.file)
      if(upErr){ alert("Upload failed: "+upErr.message); setUploadProgress(""); return }
      const {data}=supabase.storage.from('mars-files').getPublicUrl(path)
      fileUrl = data.publicUrl
      await supabase.from('files').insert({name:assignForm.file.name, url:fileUrl, size:(assignForm.file.size/1024/1024).toFixed(2)+"MB"})
      setUploadProgress("Uploaded!")
    }
    const {data,error}=await supabase.from('assignments').insert({
      title:assignForm.title, course:assignForm.course, due_date:assignForm.due_date, max_marks:assignForm.max_marks, attachment_url: fileUrl
    }).select()
    if(error) alert(error.message); else { setAssignments([...data,...assignments]); setAssignForm({title:"",course:"General",due_date:"",max_marks:100,file:null}); setUploadProgress(""); alert("Assignment published with file!") }
  }

  // 3. ADD NEW EXAM
  const addExam = async()=>{
    if(!examForm.name) return alert("Exam name required")
    const {data,error}=await supabase.from('exams').insert(examForm).select()
    if(error) alert(error.message); else { setExams([...data,...exams]); setExamForm({name:"",exam_type:"Term Test"}); alert("Exam created!") }
  }

  // 4. ADMIN PRIVILEGES - Delete/Add Faculty/Students
  const deleteUser = async(id, email)=>{
    if(!confirm(`Delete ${email}? This cannot be undone.`)) return
    await supabase.from('profiles').delete().eq('id',id)
    setUsers(users.filter(u=>u.id!==id))
  }
  const changeRole = async(id, newRole)=>{
    const {error}=await supabase.from('profiles').update({role:newRole}).eq('id',id)
    if(!error){ setUsers(users.map(u=>u.id===id?{...u,role:newRole}:u)); alert(`Role changed to ${newRole}`) }
  }
  const toggleBlock = async(u)=>{
    const {error}=await supabase.from('profiles').update({is_active:!u.is_active}).eq('id',u.id)
    if(!error) setUsers(users.map(x=>x.id===u.id?{...x,is_active:!x.is_active}:x))
  }

  return (
    <div className="space-y-6">
      {/* STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900 p-5 rounded-2xl border border-orange-500/20"><p className="text-zinc-500 text-xs">Total Registered</p><p className="text-3xl font-bold">{users.length}</p></div>
        <div className="bg-zinc-900 p-5 rounded-2xl border border-orange-500/20"><p className="text-zinc-500 text-xs">Students</p><p className="text-3xl font-bold">{users.filter(u=>u.role==='student').length}</p></div>
        <div className="bg-zinc-900 p-5 rounded-2xl border border-orange-500/20"><p className="text-zinc-500 text-xs">Faculty/Teachers</p><p className="text-3xl font-bold">{users.filter(u=>u.role==='teacher'||u.role==='faculty').length}</p></div>
        <div className="bg-zinc-900 p-5 rounded-2xl border border-orange-500/20"><p className="text-zinc-500 text-xs">Active Today</p><p className="text-3xl font-bold text-green-400">{logs.length}</p></div>
      </div>

      {/* TABS */}
      <div className="flex gap-2 overflow-auto">
        {["overview","users","add-student","add-assignment","add-exam","logs"].map(t=>(
          <button key={t} onClick={()=>setTab(t)} className={`px-4 py-2 rounded-full text-sm whitespace-nowrap ${tab===t?'bg-orange-600':'bg-zinc-800'}`}>{t.toUpperCase()}</button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab==="overview" && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-zinc-900 p-6 rounded-2xl">
            <h3 className="font-bold mb-3">Quick Add</h3>
            <div className="grid gap-2">
              <button onClick={()=>setTab("add-student")} className="bg-orange-600/20 border border-orange-500/30 p-3 rounded-lg text-left">+ Add New Student</button>
              <button onClick={()=>setTab("add-assignment")} className="bg-orange-600/20 border border-orange-500/30 p-3 rounded-lg text-left">+ Add New Assignment (with File Upload)</button>
              <button onClick={()=>setTab("add-exam")} className="bg-orange-600/20 border border-orange-500/30 p-3 rounded-lg text-left">+ Add New Exam</button>
              <button onClick={()=>setTab("users")} className="bg-zinc-800 p-3 rounded-lg text-left">Manage Users (Delete / Make Faculty)</button>
            </div>
          </div>
          <div className="bg-zinc-900 p-6 rounded-2xl">
            <h3 className="font-bold mb-3">Recent Assignments</h3>
            {assignments.slice(0,5).map(a=><div key={a.id} className="py-2 border-b border-zinc-800 text-sm flex justify-between"><span>{a.title} • {a.course}</span><span className="text-zinc-500">{new Date(a.due_date).toLocaleDateString()}</span></div>)}
          </div>
        </div>
      )}

      {/* USERS - REGISTERED THROUGH CREATE ACCOUNT */}
      {tab==="users" && (
        <div className="bg-zinc-900 p-6 rounded-2xl overflow-auto">
          <h3 className="font-bold mb-2">All Users Registered via "Create New Account" ({users.length})</h3>
          <p className="text-xs text-zinc-500 mb-4">Here you can grant admin privileges, make faculty, block or delete.</p>
          <table className="w-full text-sm min-w-[800px]">
            <thead className="text-zinc-500"><tr><th className="text-left p-2">Email</th><th>Name</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map(u=>(
                <tr key={u.id} className="border-t border-zinc-800">
                  <td className="p-2">{u.email}</td><td>{u.full_name}</td>
                  <td>
                    <select value={u.role} onChange={e=>changeRole(u.id, e.target.value)} className="bg-zinc-800 p-1 rounded text-xs">
                      <option value="student">Student</option><option value="teacher">Teacher/Faculty</option><option value="parent">Parent</option><option value="finance">Finance</option><option value="registrar">Registrar</option><option value="school_admin">School Admin</option><option value="super_admin">Super Admin</option>
                    </select>
                  </td>
                  <td><span className={`px-2 py-1 rounded text-xs ${u.is_active===false?'bg-red-600/20 text-red-400':'bg-green-600/20 text-green-400'}`}>{u.is_active===false?'Blocked':'Active'}</span></td>
                  <td className="flex gap-1 p-2">
                    <button onClick={()=>toggleBlock(u)} className="bg-zinc-700 px-2 py-1 rounded text-xs">{u.is_active===false?'Unblock':'Block'}</button>
                    <button onClick={()=>changeRole(u.id, 'teacher')} className="bg-blue-600 px-2 py-1 rounded text-xs">Make Faculty</button>
                    <button onClick={()=>deleteUser(u.id, u.email)} className="bg-red-600 px-2 py-1 rounded text-xs">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ADD STUDENT */}
      {tab==="add-student" && (
        <div className="bg-zinc-900 p-6 rounded-2xl border border-orange-500/20">
          <h3 className="font-bold mb-4">Add New Student</h3>
          <div className="grid md:grid-cols-3 gap-3">
            <input value={studForm.first_name} onChange={e=>setStudForm({...studForm,first_name:e.target.value})} placeholder="First Name" className="bg-zinc-800 p-3 rounded"/>
            <input value={studForm.last_name} onChange={e=>setStudForm({...studForm,last_name:e.target.value})} placeholder="Last Name" className="bg-zinc-800 p-3 rounded"/>
            <input value={studForm.admission_number} onChange={e=>setStudForm({...studForm,admission_number:e.target.value})} placeholder="Admission No e.g MARS2026/001" className="bg-zinc-800 p-3 rounded"/>
            <select value={studForm.class_id} onChange={e=>setStudForm({...studForm,class_id:e.target.value})} className="bg-zinc-800 p-3 rounded"><option value="">Select Class</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <button onClick={addStudent} className="bg-orange-600 rounded font-bold p-3 md:col-span-2">Create Student</button>
          </div>
          <div className="mt-6"><h4 className="text-sm text-zinc-500 mb-2">Recently Added ({students.length})</h4>{students.slice(0,10).map(s=><div key={s.id} className="text-sm py-1 border-b border-zinc-800">{s.admission_number} - {s.first_name} {s.last_name} - {s.classes?.name}</div>)}</div>
        </div>
      )}

      {/* ADD ASSIGNMENT WITH FILE UPLOAD */}
      {tab==="add-assignment" && (
        <div className="bg-zinc-900 p-6 rounded-2xl border-2 border-dashed border-orange-500/30">
          <h3 className="font-bold mb-4">Add New Assignment + File Upload</h3>
          <div className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <input value={assignForm.title} onChange={e=>setAssignForm({...assignForm,title:e.target.value})} placeholder="Title e.g Mars Atmosphere Analysis" className="bg-zinc-800 p-3 rounded"/>
              <input value={assignForm.course} onChange={e=>setAssignForm({...assignForm,course:e.target.value})} placeholder="Course e.g PHYS 220" className="bg-zinc-800 p-3 rounded"/>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <input type="datetime-local" value={assignForm.due_date} onChange={e=>setAssignForm({...assignForm,due_date:e.target.value})} className="bg-zinc-800 p-3 rounded"/>
              <input type="number" value={assignForm.max_marks} onChange={e=>setAssignForm({...assignForm,max_marks:Number(e.target.value)})} placeholder="Max Marks 100" className="bg-zinc-800 p-3 rounded"/>
            </div>
            <div>
              <label className="text-sm text-zinc-400">Upload File (PDF, ZIP, Video up to 50MB) - Students can download</label>
              <input type="file" onChange={e=>setAssignForm({...assignForm,file:e.target.files[0]})} className="block w-full mt-2 text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:bg-orange-600 file:text-white bg-zinc-800 p-2 rounded"/>
              {uploadProgress && <p className="text-xs text-orange-400 mt-1">{uploadProgress}</p>}
            </div>
            <button onClick={addAssignment} className="w-full bg-orange-600 py-3 rounded-lg font-bold">Publish Assignment with File</button>
          </div>
          <div className="mt-6"><h4 className="text-sm text-zinc-500 mb-2">Existing Assignments</h4>{assignments.map(a=><div key={a.id} className="flex justify-between py-2 text-sm border-b border-zinc-800"><span>{a.title} - {a.course}</span>{a.attachment_url && <a href={a.attachment_url} target="_blank" className="text-orange-400 underline">View File</a>}</div>)}</div>
        </div>
      )}

      {/* ADD EXAM */}
      {tab==="add-exam" && (
        <div className="bg-zinc-900 p-6 rounded-2xl border border-orange-500/20">
          <h3 className="font-bold mb-4">Add New Exam</h3>
          <div className="flex gap-3">
            <input value={examForm.name} onChange={e=>setExamForm({...examForm,name:e.target.value})} placeholder="e.g Term 3 Final 2026 - Mathematics" className="flex-1 bg-zinc-800 p-3 rounded"/>
            <select value={examForm.exam_type} onChange={e=>setExamForm({...examForm,exam_type:e.target.value})} className="bg-zinc-800 p-3 rounded"><option>Term Test</option><option>Final Exam</option><option>Quiz</option><option>Assignment</option></select>
            <button onClick={addExam} className="bg-orange-600 px-6 rounded font-bold">Create Exam</button>
          </div>
          <div className="mt-6 grid md:grid-cols-2 gap-2">{exams.map(ex=><div key={ex.id} className="bg-zinc-800 p-3 rounded text-sm flex justify-between"><span>{ex.name} • {ex.exam_type}</span><button onClick={async()=>{await supabase.from('exams').delete().eq('id',ex.id); setExams(exams.filter(x=>x.id!==ex.id))}} className="text-red-400">Delete</button></div>)}</div>
        </div>
      )}

      {/* LOGS */}
      {tab==="logs" && (
        <div className="bg-zinc-900 p-6 rounded-2xl">
          <h3 className="font-bold mb-4">Who Opened System & When - Live Access Logs</h3>
          <div className="space-y-2 max-h-[500px] overflow-auto">{logs.map(l=><div key={l.id} className="border-l-2 border-orange-500 pl-4 py-1 text-sm"><b>{new Date(l.login_time).toLocaleString()}</b> — {l.role}: {l.email}<br/><span className="text-xs text-zinc-500">{l.device?.slice(0,100)}</span></div>)}</div>
        </div>
      )}
    </div>
  )
}

// --- MAIN APP WRAPPER ---
export default function AppWrapper(){
  const [user,setUser]=useState(null), [profile,setProfile]=useState(null)
  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{ if(data.session) setUser(data.session.user) })
    supabase.auth.onAuthStateChange((e,s)=>{ if(s?.user){ setUser(s.user); logAccess(s.user) } else { setUser(null); setProfile(null) } })
  },[])
  useEffect(()=>{
    if(!user) return
    supabase.from('profiles').select('*').eq('id',user.id).single().then(({data})=>{
      if(!data){
        const role=user.user_metadata?.role||'student'
        supabase.from('profiles').insert({id:user.id,email:user.email,role,full_name:user.user_metadata?.full_name||user.email}).then(()=>setProfile({role}))
      } else setProfile(data)
    })
  },[user])

  const handleLogin=async(e)=>{
    e.preventDefault()
    const {error}=await supabase.auth.signInWithPassword({email:e.target.email.value,password:e.target.password.value})
    if(error) alert(error.message)
  }
  const handleSignup=async(e)=>{
    e.preventDefault()
    const {data,error}=await supabase.auth.signUp({email:e.target.email.value,password:e.target.password.value,options:{data:{full_name:e.target.fullname.value,role:e.target.role.value}}})
    if(error) alert(error.message); else alert("Created! Now login. If email confirm error, turn off Confirm Email in Supabase Auth settings.")
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
              <select name="role" className="w-full bg-zinc-800 p-2 rounded"><option value="student">Student</option><option value="teacher">Teacher/Faculty</option><option value="parent">Parent</option><option value="school_admin">School Admin</option><option value="super_admin">Super Admin</option></select>
              <button className="w-full bg-zinc-700 p-2 rounded mt-2">Sign Up</button>
            </form>
          </details>
        </div>
      </div>
    )
  }

  const role = profile?.role || user.user_metadata?.role || 'student'
  const isAdmin = ['super_admin','school_admin','admin'].includes(role)

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold"><span className="text-orange-500">MARS</span> • {user.email} • {role.toUpperCase()}</h1>
        <button onClick={()=>supabase.auth.signOut()} className="bg-zinc-800 px-4 py-2 rounded">Logout</button>
      </header>
      {isAdmin? <AdminDash/> : <div className="bg-zinc-900 p-8 rounded-2xl text-center"><h2 className="text-xl font-bold">Welcome {role}</h2><p className="text-zinc-400 mt-2">Admin will manage your access. Contact super_admin to get faculty privileges.</p></div>}
    </div>
  )
}