import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)

function AppWrapper(){
  const [user,setUser]=useState(null)
  const [profile,setProfile]=useState(null)
  const [loading,setLoading]=useState(true)
  const [mode,setMode]=useState("login")
  const [form,setForm]=useState({email:"",password:"",full_name:"",role:"student"})
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
    if(mode==="signup"){
      const {data,error}=await supabase.auth.signUp({email:form.email,password:form.password})
      if(error) return alert(error.message)
      if(data.user){
        await supabase.from('users').insert({id:data.user.id,email:form.email,full_name:form.full_name,role:form.role,is_active:false})
        alert("Account created! Wait for Admin approval.")
        setMode("login")
      }
    } else {
      const {data,error}=await supabase.auth.signInWithPassword({email:form.email,password:form.password})
      if(error) return alert(error.message)
      const {data:prof}=await supabase.from('users').select('*').eq('id',data.user.id).single()
      if(prof &&!prof.is_active) { alert("Account pending approval"); await supabase.auth.signOut(); return}
      setUser(data.user); setProfile(prof)
    }
  }
  const logout=async()=>{ await supabase.auth.signOut(); setUser(null); setProfile(null) }
  if(loading) return <div className="min-h-screen bg-[#080808] flex items-center justify-center text-white">Loading MARS...</div>
  if(!user) return <AuthPage mode={mode} setMode={setMode} form={form} setForm={setForm} onSubmit={handleAuth} />
  const role=(profile?.role||'').toLowerCase().trim()
  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <header className="sticky top-0 z-50 bg-black/90 backdrop-blur border-b border-white/10 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2"><div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center font-black text-white">M</div><span className="font-black text-white">MARS</span><span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full ml-2 text-white">{profile?.role}</span></div>
        <div className="flex items-center gap-2"><span className="text-xs text-zinc-400 hidden sm:block">{profile?.email}</span><button onClick={logout} className="bg-zinc-800 text-white px-3 py-1.5 rounded-full text-xs">Logout</button></div>
      </header>
      <main className="p-3 md:p-6">
        {['super_admin','school_admin','admin'].includes(role)? <AdminDash profile={profile} /> : null}
        {['faculty','teacher'].includes(role)? <FacultyDash profile={profile} /> : null}
        {role==='student'? <StudentDash profile={profile} /> : null}
        {role==='parent'? <ParentDash profile={profile} /> : null}
      </main>
    </div>
  )
}

function AuthPage({mode,setMode,form,setForm,onSubmit}){
  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-white/10 p-6 md:p-8 rounded-[24px] w-full max-w-[400px]">
        <div className="flex items-center gap-2 mb-6"><div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center font-black text-white">M</div><div><p className="font-black text-white">MARS E-School</p><p className="text-[10px] text-zinc-500">Modern Learning OS</p></div></div>
        <h2 className="text-2xl font-black text-white mb-2">{mode==="login"?"Welcome Back":"Create Account"}</h2>
        <p className="text-xs text-zinc-400 mb-4">Login text is white now</p>
        <form onSubmit={onSubmit} className="space-y-3 mt-4">
          <input value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="Email" type="email" required className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white placeholder:text-zinc-400 focus:text-white"/>
          <input value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Password" type="password" required className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white placeholder:text-zinc-400"/>
          {mode==="signup" && <>
            <input value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} placeholder="Full Name" required className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white placeholder:text-zinc-400"/>
            <select value={form.role} onChange={e=>setForm({...form,role:e.target.value})} className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white">
              <option value="student">Student</option><option value="faculty">Faculty / Teacher</option><option value="parent">Parent</option>
            </select>
          </>}
          <button type="submit" className="w-full bg-orange-600 py-3.5 rounded-2xl font-black text-white">{mode==="login"?"Login":"Sign Up"}</button>
        </form>
        <p className="text-center text-sm text-zinc-400 mt-4">{mode==="login"?"No account?":"Have account?"} <button onClick={()=>setMode(mode==="login"?"signup":"login")} className="text-orange-400 font-bold">{mode==="login"?"Sign Up":"Login"}</button></p>
      </div>
    </div>
  )
}

function AdminDash({profile}){
  const [users,setUsers]=useState([]); const [classes,setClasses]=useState([]); const [assignments,setAssignments]=useState([])
  const [tab,setTab]=useState("classes")
  const [classForm,setClassForm]=useState({name:"",faculty_id:"",student_ids:[]})
  const [assignForm,setAssignForm]=useState({title:"",course:"",due_date:"",class_id:"",file:null})
  const [uploading,setUploading]=useState(false)
  const [subCount,setSubCount]=useState({})
  const [editClassId,setEditClassId]=useState(null)
  const [addStudentIds,setAddStudentIds]=useState([])

  const load=async()=>{
    const {data:u}=await supabase.from('users').select('*').order('created_at',{ascending:false}); if(u) setUsers(u)
    const {data:c}=await supabase.from('classes').select('*').order('name'); if(c) setClasses(c)
    const {data:a}=await supabase.from('assignments').select('*').order('created_at',{ascending:false}); if(a){ setAssignments(a); const {data:subs}=await supabase.from('submissions').select('assignment_id'); const m={}; subs?.forEach(s=>m[s.assignment_id]=(m[s.assignment_id]||0)+1); setSubCount(m)}
  }
  useEffect(()=>{load()},[])

  const facultyList=users.filter(u=>['faculty','teacher'].includes((u.role||'').toLowerCase().trim()))
  const studentList=users.filter(u=>(u.role||'').toLowerCase()==='student')
  const pending=users.filter(u=>!u.is_active)
  const expiredCount=assignments.filter(a=>a.due_date&&new Date(a.due_date)<new Date()).length
  const canGiveSuper = (profile.role||'').toLowerCase()==='super_admin'

  const toggleStudentInForm=(id)=>{
    setClassForm(prev=> prev.student_ids.includes(id)? {...prev, student_ids: prev.student_ids.filter(s=>s!==id)} : {...prev, student_ids: [...prev.student_ids, id]} )
  }

  const createClass=async()=>{
    if(!classForm.name) return alert("Name needed")
    const {data:cls,error}=await supabase.from('classes').insert({name:classForm.name,faculty_id:classForm.faculty_id||null}).select().single()
    if(error) return alert(error.message)
    if(classForm.student_ids.length>0){
      await supabase.from('users').update({class_id:cls.id}).in('id',classForm.student_ids)
    }
    setClassForm({name:"",faculty_id:"",student_ids:[]})
    load()
  }

  const addStudentsToClass=async(classId)=>{
    if(addStudentIds.length===0) return
    await supabase.from('users').update({class_id:classId}).in('id',addStudentIds)
    setAddStudentIds([]); setEditClassId(null); load()
  }

  const exportUsers=()=>{
    const rows=users.map(u=>({Email:u.email,Name:u.full_name,Role:u.role,Class:classes.find(c=>c.id===u.class_id)?.name||'No Class',Status:u.is_active?'Active':'Pending'}))
    const ws=XLSX.utils.json_to_sheet(rows); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"Users"); XLSX.writeFile(wb,`MARS-Users-${new Date().toISOString().slice(0,10)}.xlsx`)
  }
  const exportClasses=()=>{
    const rows=[]
    classes.forEach(c=>{
      const faculty=users.find(u=>u.id===c.faculty_id)
      const students=users.filter(u=>u.class_id===c.id)
      if(students.length===0){
        rows.push({Class:c.name,Faculty:faculty?.email||'No faculty',Faculty_Name:faculty?.full_name||'',Student_Email:'No students',Student_Name:'',Student_Role:''})
      } else {
        students.forEach(s=>{
          rows.push({Class:c.name,Faculty:faculty?.email||'No faculty',Faculty_Name:faculty?.full_name||'',Student_Email:s.email,Student_Name:s.full_name,Student_Role:s.role,Student_Status:s.is_active?'Active':'Pending'})
        })
      }
    })
    const ws=XLSX.utils.json_to_sheet(rows); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"Classes-Roster"); XLSX.writeFile(wb,`MARS-Classes-${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  return (
    <div className="space-y-6 max-w-[1300px] mx-auto w-full">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-zinc-900/70 border border-white/10 p-5 rounded-[20px]"><p className="text-[10px] uppercase text-zinc-500">Pending</p><p className="text-3xl font-black text-orange-400">{pending.length}</p></div>
        <div className="bg-zinc-900/70 border border-white/10 p-5 rounded-[20px]"><p className="text-[10px] uppercase text-zinc-500">Students</p><p className="text-3xl font-black text-white">{studentList.filter(s=>s.is_active).length}</p></div>
        <div className="bg-zinc-900/70 border border-white/10 p-5 rounded-[20px]"><p className="text-[10px] uppercase text-zinc-500">Faculty</p><p className="text-3xl font-black text-white">{facultyList.length}</p></div>
        <div className="bg-zinc-900/70 border border-red-500/20 p-5 rounded-[20px]"><p className="text-[10px] uppercase text-zinc-500">Expired</p><p className="text-3xl font-black text-red-400">{expiredCount}</p></div>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button onClick={exportUsers} className="bg-white text-black px-4 py-2 rounded-full text-xs font-black">📊 Export Users</button>
        <button onClick={exportClasses} className="bg-orange-600 text-white px-4 py-2 rounded-full text-xs font-black">🏫 Export Classes + Roster</button>
      </div>
      <div className="flex gap-2 bg-zinc-900/80 p-1 rounded-full overflow-x-auto border border-white/10">
        {[{id:"approvals",l:`Approvals (${pending.length})`},{id:"users",l:"All Users"},{id:"classes",l:`Classes (${classes.length})`},{id:"assignments",l:`Assignments (${assignments.length})`}].map(t=><button key={t.id} onClick={()=>setTab(t.id)} className={`px-5 py-2.5 rounded-full text-sm font-bold shrink-0 ${tab===t.id?'bg-orange-600 text-white':'text-zinc-400'}`}>{t.l}</button>)}
      </div>

      {tab==="classes" && (
        <div className="space-y-6">
          {/* CREATE CLASS WITH STUDENTS */}
          <div className="bg-zinc-900/70 border border-white/10 p-4 md:p-6 rounded-[24px]">
            <h3 className="font-black mb-4 text-white">Create Class + Assign</h3>
            <input value={classForm.name} onChange={e=>setClassForm({...classForm,name:e.target.value})} placeholder="e.g Form 1A" className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl mb-3 text-white placeholder:text-zinc-500"/>
            <select value={classForm.faculty_id} onChange={e=>setClassForm({...classForm,faculty_id:e.target.value})} className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl mb-3 text-white">
              <option value="">Select Faculty (Teacher)</option>{facultyList.map(f=><option key={f.id} value={f.id}>{f.full_name||f.email} - {f.email}</option>)}
            </select>
            <p className="text-xs text-zinc-400 mb-2">Select Students for this class ({classForm.student_ids.length} selected):</p>
            <div className="bg-black/40 border border-white/5 rounded-2xl p-3 max-h-[200px] overflow-auto grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
              {studentList.map(s=>{
                const checked=classForm.student_ids.includes(s.id)
                return <label key={s.id} className={`flex items-center gap-2 p-2 rounded-xl cursor-pointer border ${checked?'bg-orange-600/20 border-orange-500/30':'bg-zinc-800/50 border-white/5'}`}><input type="checkbox" checked={checked} onChange={()=>toggleStudentInForm(s.id)} className="accent-orange-600"/><span className="text-xs text-white truncate">{s.email}</span></label>
              })}
              {studentList.length===0 && <p className="text-xs text-zinc-500">No students found</p>}
            </div>
            <button onClick={createClass} className="w-full bg-orange-600 py-3.5 rounded-2xl font-black text-white">Create Class with {classForm.student_ids.length} Students</button>
          </div>

          {/* EXISTING CLASSES - MANAGE */}
          <div className="grid gap-4">
            {classes.map(c=>{
              const faculty=users.find(u=>u.id===c.faculty_id)
              const students=users.filter(u=>u.class_id===c.id)
              const isEditing=editClassId===c.id
              return (
                <div key={c.id} className="bg-zinc-900/80 border border-white/10 p-4 md:p-5 rounded-[24px]">
                  <div className="flex flex-col md:flex-row justify-between gap-3">
                    <div className="min-w-0"><p className="font-black text-white text-lg">{c.name}</p><p className="text-xs text-zinc-400">Faculty: <span className="text-white">{faculty?.email||'Not assigned'}</span> • {students.length} students</p></div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={()=>{ setEditClassId(isEditing?null:c.id); setAddStudentIds([])}} className="bg-zinc-800 text-white px-3 py-2 rounded-full text-xs font-bold">{isEditing?'Close':'Add Students'}</button>
                      <select value={c.faculty_id||''} onChange={async(e)=>{await supabase.from('classes').update({faculty_id:e.target.value||null}).eq('id',c.id); load()}} className="bg-zinc-800 border border-white/10 p-2 rounded-xl text-xs text-white"><option value="">No Faculty</option>{facultyList.map(f=><option key={f.id} value={f.id}>{f.email}</option>)}</select>
                      <button onClick={async()=>{if(!confirm('Delete class?'))return; await supabase.from('users').update({class_id:null}).eq('class_id',c.id); await supabase.from('classes').delete().eq('id',c.id); load()}} className="bg-red-500/20 text-red-400 px-3 py-2 rounded-full text-xs">Delete</button>
                    </div>
                  </div>
                  {/* Student list */}
                  <div className="mt-3 flex flex-wrap gap-1.5">{students.map(s=><span key={s.id} className="bg-black/50 border border-white/10 px-2.5 py-1 rounded-full text-[11px] text-white flex items-center gap-1.5">{s.email}<button onClick={async()=>{await supabase.from('users').update({class_id:null}).eq('id',s.id); load()}} className="text-red-400 font-bold ml-1">×</button></span>)}{students.length===0&&<span className="text-xs text-zinc-500">No students yet</span>}</div>
                  {/* Add students panel */}
                  {isEditing && (
                    <div className="mt-4 bg-black/40 border border-white/5 rounded-2xl p-3">
                      <p className="text-xs text-zinc-300 mb-2">Select students to ADD to {c.name} (only unassigned shown):</p>
                      <div className="max-h-[200px] overflow-auto grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {users.filter(u=>(u.role||'').toLowerCase()==='student' &&!u.class_id).map(s=>{
                          const checked=addStudentIds.includes(s.id)
                          return <label key={s.id} className={`flex items-center gap-2 p-2 rounded-xl cursor-pointer border ${checked?'bg-orange-600/20 border-orange-500/30':'bg-zinc-800/50 border-white/5'}`}><input type="checkbox" checked={checked} onChange={()=>setAddStudentIds(prev=> prev.includes(s.id)? prev.filter(x=>x!==s.id) : [...prev, s.id])} className="accent-orange-600"/><span className="text-xs text-white truncate">{s.email}</span></label>
                        })}
                      </div>
                      <button onClick={()=>addStudentsToClass(c.id)} className="mt-3 w-full bg-white text-black py-2.5 rounded-xl text-xs font-black">Add {addStudentIds.length} Selected to Class</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {tab==="users" && (<div className="bg-zinc-900/70 border border-white/10 rounded-[24px] p-2 md:p-6 overflow-hidden"><div className="w-full overflow-x-auto"><table className="w-full text-sm min-w-[950px]"><thead><tr className="text-zinc-500 text-xs uppercase"><th className="text-left p-3">USER</th><th>ROLE</th><th>CLASS</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{users.map(u=><tr key={u.id} className="border-t border-white/5"><td className="p-3"><p className="font-bold text-white truncate max-w-[200px]">{u.email}</p><p className="text-xs text-zinc-500">{u.full_name}</p></td><td><select value={(u.role||'').toLowerCase()} disabled={u.id===profile.id} onChange={async(e)=>{let newRole=e.target.value; if(newRole==='super_admin' &&!canGiveSuper){alert("Only super_admin can assign super_admin"); return;} await supabase.from('users').update({role:newRole}).eq('id',u.id); load()}} className="bg-black border border-white/10 p-2 rounded-xl text-xs text-white disabled:opacity-50"><option value="student">student</option><option value="faculty">faculty</option><option value="teacher">teacher</option><option value="school_admin">school_admin</option>{canGiveSuper && <option value="super_admin">super_admin</option>}</select></td><td><select value={u.class_id||''} onChange={async(e)=>{await supabase.from('users').update({class_id:e.target.value||null}).eq('id',u.id); load()}} className="bg-zinc-800 border border-white/10 p-2 rounded-xl text-xs text-white"><option value="">No Class</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></td><td>{u.is_active?<span className="bg-green-500/20 text-green-400 px-2 py-1 rounded-full text-xs">Active</span>:<span className="bg-orange-500/20 text-orange-400 px-2 py-1 rounded-full text-xs">Pending</span>}</td><td><button onClick={async()=>{await supabase.from('users').update({is_active:!u.is_active}).eq('id',u.id); load()}} className="bg-zinc-800 text-white px-3 py-1 rounded-xl text-xs">{u.is_active?'Revoke':'Approve'}</button></td></tr>)}</tbody></table></div></div>)}
      {tab==="approvals" && (<div className="bg-zinc-900/70 border border-white/10 rounded-[24px] p-6"><h3 className="font-black text-white">New Accounts Waiting</h3><div className="grid gap-3 mt-4">{pending.length===0&&<p className="text-zinc-500 text-sm">No pending</p>}{pending.map(u=>(<div key={u.id} className="bg-black/40 border border-white/5 p-4 rounded-2xl flex justify-between gap-3"><div><p className="font-bold text-white">{u.email}</p><p className="text-xs text-zinc-400">{u.full_name} - {u.role}</p></div><div className="flex gap-2"><button onClick={async()=>{await supabase.from('users').update({is_active:true}).eq('id',u.id); load()}} className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold">Approve</button><button onClick={async()=>{await supabase.from('users').delete().eq('id',u.id); load()}} className="bg-zinc-800 text-white px-3 py-2 rounded-xl text-sm">Reject</button></div></div>))}</div></div>)}
      {tab==="assignments" && (<div className="grid lg:grid-cols-2 gap-6"><div className="bg-zinc-900/70 border border-orange-500/20 p-6 rounded-[24px] h-fit"><h3 className="font-black mb-4 text-white">Publish Assignment</h3><div className="space-y-3"><input value={assignForm.title} onChange={e=>setAssignForm({...assignForm,title:e.target.value})} placeholder="Title" className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white placeholder:text-zinc-500"/><div className="grid grid-cols-2 gap-3"><input value={assignForm.course} onChange={e=>setAssignForm({...assignForm,course:e.target.value})} placeholder="Course" className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white"/><select value={assignForm.class_id} onChange={e=>setAssignForm({...assignForm,class_id:e.target.value})} className="bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white"><option value="">All Classes</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div><input type="datetime-local" value={assignForm.due_date} onChange={e=>setAssignForm({...assignForm,due_date:e.target.value})} className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white"/><input type="file" onChange={e=>setAssignForm({...assignForm,file:e.target.files[0]})} className="w-full text-sm file:bg-orange-600 file:text-white file:border-0 file:px-4 file:py-2 file:rounded-xl bg-zinc-800 border border-white/10 p-2 rounded-2xl text-white"/><button disabled={uploading} onClick={async()=>{if(!assignForm.title||!assignForm.due_date)return alert('Title & Due date needed'); setUploading(true); let url=null; if(assignForm.file){const path=`${Date.now()}_${assignForm.file.name}`; const {error}=await supabase.storage.from('mars-files').upload(path,assignForm.file); if(error){alert(error.message); setUploading(false); return;} url=supabase.storage.from('mars-files').getPublicUrl(path).data.publicUrl} const {data:ses}=await supabase.auth.getUser(); const {error}=await supabase.from('assignments').insert({title:assignForm.title,course:assignForm.course,due_date:assignForm.due_date,class_id:assignForm.class_id||null,attachment_url:url,created_by:ses.user.id}); if(error) alert(error.message); setUploading(false); setAssignForm({title:"",course:"",due_date:"",class_id:"",file:null}); load()}} className="w-full bg-orange-600 py-3.5 rounded-2xl font-black text-white">{uploading?'Publishing...':'Publish'}</button></div></div><div className="bg-zinc-900/70 border border-white/10 p-6 rounded-[24px]"><h3 className="font-black mb-4 text-white">Assignments ({assignments.length})</h3><div className="space-y-2 max-h-[600px] overflow-auto">{assignments.map(a=>{const isExpired=a.due_date&&new Date(a.due_date)<new Date(); return <div key={a.id} className={`p-3 rounded-xl flex justify-between gap-2 border ${isExpired?'bg-red-500/10 border-red-500/20':'bg-black/40 border-white/5'}`}><div><p className="font-bold text-sm text-white">{a.title} <span className="text-orange-400 text-xs">{subCount[a.id]?`${subCount[a.id]} subs`:''}</span></p><p className="text-[10px] text-zinc-500">Due: {a.due_date?new Date(a.due_date).toLocaleString():'No due'}</p></div><div className="flex gap-1">{a.attachment_url&&<a href={a.attachment_url} target="_blank" className="text-orange-400 underline text-xs">File</a>}<button onClick={async()=>{await supabase.from('assignments').delete().eq('id',a.id); load()}} className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-xs">Delete</button></div></div>})}</div></div></div>)}
    </div>
  )
}

function FacultyDash({profile}){
  const [classes,setClasses]=useState([]); const [assignments,setAssignments]=useState([]); const [subs,setSubs]=useState([]); const [filterClass,setFilterClass]=useState("all"); const [grading,setGrading]=useState({})
  useEffect(()=>{(async()=>{const {data:c}=await supabase.from('classes').select('*'); if(c) setClasses(c); const {data:a}=await supabase.from('assignments').select('*').order('created_at',{ascending:false}); if(a) setAssignments(a); const {data:s}=await supabase.from('submissions').select('*, users!inner(email,full_name,class_id), assignments!inner(title,course,class_id)'); if(s) setSubs(s)})()},[])
  const myClasses=classes.filter(c=>c.faculty_id===profile.id); const myClassIds=myClasses.map(c=>c.id)
  const visibleSubs=subs.filter(s=>{if(filterClass==="all") return myClassIds.length===0 || myClassIds.includes(s.users.class_id) || myClassIds.includes(s.assignments.class_id) || s.assignments.class_id===null; return s.users.class_id===filterClass || s.assignments.class_id===filterClass})
  const handleGrade=async(id)=>{const g=grading[id]; if(!g) return; await supabase.from('submissions').update({grade:g}).eq('id',id); alert("Graded!"); const {data:s}=await supabase.from('submissions').select('*, users!inner(email,full_name,class_id), assignments!inner(title,course,class_id)'); if(s) setSubs(s)}
  return <div className="max-w-[1200px] mx-auto space-y-6"><div className="bg-zinc-900/70 border border-white/10 p-5 rounded-[20px] flex flex-col sm:flex-row justify-between gap-3"><div><h2 className="text-xl font-black text-white">Faculty Dashboard</h2><p className="text-xs text-zinc-400">Classes: {myClasses.length? myClasses.map(c=>c.name).join(', ') : 'All Classes'} - Total: {visibleSubs.length}</p></div><select value={filterClass} onChange={e=>setFilterClass(e.target.value)} className="bg-zinc-800 border border-white/10 p-2.5 rounded-xl text-sm text-white"><option value="all">All My Classes</option>{myClasses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div className="grid lg:grid-cols-2 gap-6"><div className="bg-zinc-900/70 border border-white/10 rounded-[24px] p-6"><h3 className="font-black mb-4 text-white">My Assignments</h3><div className="space-y-2 max-h-[500px] overflow-auto">{assignments.filter(a=> myClassIds.length===0 || myClassIds.includes(a.class_id) || a.class_id===null).map(a=><div key={a.id} className="bg-black/40 p-3 rounded-xl"><p className="font-bold text-sm text-white">{a.title} - {a.course}</p><p className="text-[10px] text-zinc-500">Due: {a.due_date?new Date(a.due_date).toLocaleString():'No due'}</p></div>)}</div></div><div className="bg-zinc-900/70 border border-orange-500/20 rounded-[24px] p-6"><h3 className="font-black mb-4 text-white">Submissions ({visibleSubs.length})</h3><div className="space-y-2 max-h-[500px] overflow-auto">{visibleSubs.map(s=><div key={s.id} className="bg-black/60 border border-white/5 p-3 rounded-xl flex flex-col gap-2"><div className="flex justify-between"><p className="font-bold text-sm text-white truncate">{s.users.email}</p><span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-white">{s.assignments.title}</span></div><div className="flex gap-2 items-center"><a href={s.file_url} target="_blank" className="text-orange-400 underline text-xs flex-1 truncate">View Work</a><input value={grading[s.id]?? s.grade?? ''} onChange={e=>setGrading({...grading,[s.id]:e.target.value})} placeholder="Grade" className="bg-zinc-800 border border-white/10 p-2 rounded-xl w-20 text-sm text-white"/><button onClick={()=>handleGrade(s.id)} className="bg-orange-600 text-white px-3 py-2 rounded-xl text-xs font-bold">Save</button></div></div>)}</div></div></div></div>
}
function StudentDash({profile}){
  const [assignments,setAssignments]=useState([]); const [mySubs,setMySubs]=useState([])
  useEffect(()=>{(async()=>{let q=supabase.from('assignments').select('*').order('due_date'); if(profile.class_id) q=q.or(`class_id.eq.${profile.class_id},class_id.is.null`); const {data}=await q; if(data) setAssignments(data); const {data:s}=await supabase.from('submissions').select('*').eq('student_id',profile.id); if(s) setMySubs(s)})()},[profile])
  const submitWork=async(assignmentId,file)=>{if(!file) return; const path=`${profile.id}/${Date.now()}_${file.name}`; const {error}=await supabase.storage.from('mars-files').upload(path,file); if(error) return alert(error.message); const url=supabase.storage.from('mars-files').getPublicUrl(path).data.publicUrl; await supabase.from('submissions').insert({assignment_id:assignmentId,student_id:profile.id,file_url:url,status:'submitted'}); alert("Submitted!")}
  return <div className="max-w-[900px] mx-auto space-y-4"><h2 className="text-xl font-black text-white">My Assignments</h2>{assignments.map(a=>{const isDone=mySubs.find(s=>s.assignment_id===a.id); const isExpired=a.due_date&&new Date(a.due_date)<new Date(); return <div key={a.id} className={`p-4 rounded-2xl border ${isExpired?'bg-red-500/10 border-red-500/20':'bg-zinc-900/70 border-white/10'}`}><div className="flex justify-between"><p className="font-bold text-white">{a.title} - {a.course}</p>{isDone&&<span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full text-xs">{isDone.grade?`Grade: ${isDone.grade}`:'Submitted'}</span>}</div><p className="text-xs text-zinc-500">Due: {a.due_date?new Date(a.due_date).toLocaleString():'No due'}</p>{a.attachment_url&&<a href={a.attachment_url} target="_blank" className="text-orange-400 text-xs underline">Download</a>}<div className="mt-3"><input type="file" onChange={e=>submitWork(a.id,e.target.files[0])} className="text-xs file:bg-orange-600 file:text-white file:border-0 file:px-3 file:py-1 file:rounded-full text-white"/></div></div>})}</div>
}
function ParentDash({profile}){const [child,setChild]=useState(null); useEffect(()=>{(async()=>{if(profile.linked_student_id){const {data}=await supabase.from('users').select('*').eq('id',profile.linked_student_id).single(); setChild(data)}})()},[profile]); return <div className="max-w-[800px] mx-auto"><h2 className="text-xl font-black text-white">Parent View</h2><p className="text-zinc-400">Child: {child?.email||'Not linked'}</p></div>}

export default AppWrapper