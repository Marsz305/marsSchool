import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)

// ========== ADMIN ==========
function AdminDash({refresh}){
  const [users,setUsers]=useState([]); const [classes,setClasses]=useState([]); const [assignments,setAssignments]=useState([])
  const [tab,setTab]=useState("approvals")
  const [classForm,setClassForm]=useState({name:"",faculty_id:""})
  const [assignForm,setAssignForm]=useState({title:"",course:"",due_date:"",class_id:"",file:null})
  const [uploading,setUploading]=useState(false)

  const load=async()=>{
    const {data:u}=await supabase.from('users').select('*, classes(name)').order('created_at',{ascending:false})
    const {data:c}=await supabase.from('classes').select('*, users!classes_faculty_id_fkey(email,full_name)').order('name')
    const {data:a}=await supabase.from('assignments').select('*, classes(name)').order('created_at',{ascending:false})
    if(u) setUsers(u); if(c) setClasses(c); if(a) setAssignments(a)
  }
  useEffect(()=>{load()},[])

  const facultyList = users.filter(u=>['faculty','teacher'].includes(u.role))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {l:"Pending", v: users.filter(u=>!u.is_active).length, c:"text-orange-400"},
          {l:"Students", v: users.filter(u=>u.role==='student' && u.is_active).length, c:"text-white"},
          {l:"Faculty", v: facultyList.length, c:"text-white"},
          {l:"Classes", v: classes.length, c:"text-white"},
        ].map(s=><div key={s.l} className="bg-zinc-900/70 backdrop-blur border border-white/10 p-5 rounded-[20px]"><p className="text-[10px] uppercase tracking-widest text-zinc-500">{s.l}</p><p className={`text-3xl font-black ${s.c}`}>{s.v}</p></div>)}
      </div>

      <div className="flex gap-2 bg-zinc-900/80 p-1 rounded-full w-fit border border-white/10">
        {[{id:"approvals",l:`Approvals (${users.filter(u=>!u.is_active).length})`},{id:"users",l:"All Users"},{id:"classes",l:"Classes"},{id:"assignments",l:"Assignments"}].map(t=>
          <button key={t.id} onClick={()=>setTab(t.id)} className={`px-5 py-2.5 rounded-full text-sm font-bold ${tab===t.id?'bg-orange-600 text-white':'text-zinc-400'}`}>{t.l}</button>
        )}
      </div>

      {tab==="approvals" && (
        <div className="bg-zinc-900/70 border border-white/10 rounded-[24px] p-6">
          <h3 className="font-black text-lg">New Accounts Waiting</h3><p className="text-zinc-500 text-sm mb-4">Grant access + assign class. Students can't login until approved.</p>
          <div className="grid gap-3">
            {users.filter(u=>!u.is_active).length===0 && <p className="text-center py-10 text-zinc-500">No pending requests</p>}
            {users.filter(u=>!u.is_active).map(u=>(
              <div key={u.id} className="bg-black/40 border border-white/5 p-4 rounded-2xl flex flex-wrap justify-between gap-3">
                <div><p className="font-bold">{u.email}</p><p className="text-xs text-zinc-400">{u.full_name} • {u.role}</p></div>
                <div className="flex gap-2">
                  <select id={`c-${u.id}`} className="bg-zinc-800 border border-white/10 p-2.5 rounded-xl text-sm"><option value="">Select Class</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
                  <button onClick={async()=>{ const cid=document.getElementById(`c-${u.id}`).value||null; await supabase.from('users').update({is_active:true, class_id:cid}).eq('id',u.id); load()}} className="bg-green-600 px-4 py-2 rounded-xl font-bold text-sm">Approve</button>
                  <button onClick={async()=>{ await supabase.from('users').delete().eq('id',u.id); load()}} className="bg-zinc-800 px-3 py-2 rounded-xl text-sm">Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab==="users" && (
        <div className="bg-zinc-900/70 border border-white/10 rounded-[24px] p-6 overflow-auto">
          <table className="w-full text-sm min-w-[900px]"><thead><tr className="text-zinc-500 text-xs uppercase"><th className="text-left p-3">User</th><th>Role</th><th>Class</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>{users.map(u=><tr key={u.id} className="border-t border-white/5">
              <td className="p-3 font-bold">{u.email}<p className="text-xs text-zinc-500 font-normal">{u.full_name}</p></td>
              <td><select value={u.role} onChange={async(e)=>{await supabase.from('users').update({role:e.target.value}).eq('id',u.id); load()}} className="bg-black border border-white/10 p-2 rounded-xl text-xs">{['student','faculty','teacher','parent','school_admin','super_admin'].map(r=><option key={r} value={r}>{r}</option>)}</select></td>
              <td className="text-xs">{u.classes?.name || classes.find(c=>c.id===u.class_id)?.name || '—'}</td>
              <td>{u.is_active? <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded-full text-xs">Active</span> : <span className="bg-orange-500/20 text-orange-400 px-2 py-1 rounded-full text-xs">Pending</span>}</td>
              <td className="flex gap-1 p-2"><button onClick={async()=>{await supabase.from('users').update({is_active:!u.is_active}).eq('id',u.id); load()}} className="bg-zinc-800 px-3 py-1.5 rounded-xl text-xs">{u.is_active?'Revoke':'Approve'}</button><button onClick={async()=>{if(confirm('Delete?')){await supabase.from('users').delete().eq('id',u.id); load()}}} className="bg-red-500/20 text-red-400 px-3 py-1.5 rounded-xl text-xs">Delete</button></td>
            </tr>)}</tbody></table>
        </div>
      )}

      {tab==="classes" && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-zinc-900/70 border border-white/10 p-6 rounded-[24px]">
            <h3 className="font-black mb-4">Create Class + Assign Faculty</h3>
            <input value={classForm.name} onChange={e=>setClassForm({...classForm,name:e.target.value})} placeholder="e.g Form 1A, CS4000" className="w-full bg-black border border-white/10 p-3.5 rounded-2xl mb-3"/>
            <select value={classForm.faculty_id} onChange={e=>setClassForm({...classForm,faculty_id:e.target.value})} className="w-full bg-black border border-white/10 p-3.5 rounded-2xl mb-3"><option value="">Select Faculty</option>{facultyList.map(f=><option key={f.id} value={f.id}>{f.email}</option>)}</select>
            <button onClick={async()=>{ if(!classForm.name) return; const {error}=await supabase.from('classes').insert({name:classForm.name, faculty_id:classForm.faculty_id||null}).select(); if(error) alert(error.message); else {setClassForm({name:"",faculty_id:""}); load()}}} className="w-full bg-orange-600 py-3.5 rounded-2xl font-black">Create Class</button>
            <div className="mt-6 space-y-2">{classes.map(c=><div key={c.id} className="bg-black/40 border border-white/5 p-4 rounded-2xl flex justify-between"><div><p className="font-bold">{c.name}</p><p className="text-xs text-zinc-500">{users.filter(u=>u.class_id===c.id).length} students • Faculty: {c.users?.email || facultyList.find(f=>f.id===c.faculty_id)?.email || 'None'}</p></div><select value={c.faculty_id||''} onChange={async(e)=>{await supabase.from('classes').update({faculty_id:e.target.value||null}).eq('id',c.id); load()}} className="bg-zinc-800 text-xs p-2 rounded-xl"><option value="">Assign Faculty</option>{facultyList.map(f=><option key={f.id} value={f.id}>{f.email}</option>)}</select></div>)}</div>
          </div>
          <div className="bg-zinc-900/70 border border-white/10 p-6 rounded-[24px]"><h3 className="font-black mb-4">Class Roster</h3>{classes.map(c=><div key={c.id} className="mb-4"><p className="font-bold text-orange-400">{c.name}</p><div className="mt-2 space-y-1">{users.filter(u=>u.class_id===c.id).map(u=><div key={u.id} className="text-sm bg-black/40 p-2 rounded-xl border border-white/5 flex justify-between"><span>{u.email} ({u.role})</span><span className="text-xs text-zinc-500">{u.is_active?'Active':'Pending'}</span></div>)}{users.filter(u=>u.class_id===c.id).length===0 && <p className="text-xs text-zinc-600">No students yet</p>}</div></div>)}</div>
        </div>
      )}

      {tab==="assignments" && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-zinc-900/70 border border-orange-500/20 p-6 rounded-[24px]">
            <h3 className="font-black mb-4">Publish Assignment to Class</h3>
            <div className="space-y-3">
              <input value={assignForm.title} onChange={e=>setAssignForm({...assignForm,title:e.target.value})} placeholder="Title" className="w-full bg-black border border-white/10 p-3.5 rounded-2xl"/>
              <div className="grid grid-cols-2 gap-3"><input value={assignForm.course} onChange={e=>setAssignForm({...assignForm,course:e.target.value})} placeholder="Course" className="bg-black border border-white/10 p-3.5 rounded-2xl"/><select value={assignForm.class_id} onChange={e=>setAssignForm({...assignForm,class_id:e.target.value})} className="bg-black border border-white/10 p-3.5 rounded-2xl"><option value="">All Classes</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <input type="datetime-local" value={assignForm.due_date} onChange={e=>setAssignForm({...assignForm,due_date:e.target.value})} className="w-full bg-black border border-white/10 p-3.5 rounded-2xl"/>
              <input type="file" onChange={e=>setAssignForm({...assignForm,file:e.target.files[0]})} className="w-full text-sm file:bg-orange-600 file:text-white file:border-0 file:px-4 file:py-2 file:rounded-xl bg-black border border-white/10 p-2 rounded-2xl"/>
              <button disabled={uploading} onClick={async()=>{ if(!assignForm.title||!assignForm.due_date) return alert('Title & Due date needed'); setUploading(true); let url=null; if(assignForm.file){ const path=`${Date.now()}_${assignForm.file.name}`; const {error}=await supabase.storage.from('mars-files').upload(path, assignForm.file); if(!error) url=supabase.storage.from('mars-files').getPublicUrl(path).data.publicUrl } await supabase.from('assignments').insert({title:assignForm.title,course:assignForm.course,due_date:assignForm.due_date,class_id:assignForm.class_id||null,attachment_url:url}); setUploading(false); setAssignForm({title:"",course:"",due_date:"",class_id:"",file:null}); load()}} className="w-full bg-orange-600 py-3.5 rounded-2xl font-black">{uploading?'Publishing...':'Publish'}</button>
            </div>
          </div>
          <div className="bg-zinc-900/70 border border-white/10 p-6 rounded-[24px]"><h3 className="font-black mb-4">All Assignments</h3><div className="space-y-2">{assignments.map(a=><div key={a.id} className="bg-black/40 border border-white/5 p-3 rounded-xl flex justify-between text-sm"><span>{a.title} • <b className="text-orange-400">{a.classes?.name||'All'}</b> • due {a.due_date? new Date(a.due_date).toLocaleDateString():''}</span>{a.attachment_url && <a href={a.attachment_url} target="_blank" className="text-orange-400 underline">File</a>}</div>)}</div></div>
        </div>
      )}
    </div>
  )
}

// ========== FACULTY ==========
function FacultyDash({user, profile}){
  const [myClasses,setMyClasses]=useState([]); const [students,setStudents]=useState([]); const [assignments,setAssignments]=useState([])
  const [form,setForm]=useState({title:"",course:"",due_date:"",class_id:"",file:null})
  useEffect(()=>{
    (async()=>{
      const {data:c}=await supabase.from('classes').select('*').eq('faculty_id',user.id)
      if(c) { setMyClasses(c); const ids=c.map(x=>x.id); if(ids.length){ const {data:u}=await supabase.from('users').select('*').in('class_id',ids); if(u) setStudents(u); const {data:a}=await supabase.from('assignments').select('*, classes(name)').in('class_id',ids); if(a) setAssignments(a) } }
    })()
  },[])
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-orange-600/20 to-zinc-900 border border-orange-500/20 p-6 rounded-[24px]"><h2 className="text-2xl font-black">Welcome, {profile.full_name||user.email}</h2><p className="text-zinc-400">You teach {myClasses.length} class{myClasses.length!==1?'es':''}: {myClasses.map(c=>c.name).join(', ')||'No class assigned yet — contact super_admin'}</p></div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900/70 border border-white/10 p-6 rounded-[24px]"><h3 className="font-black mb-4">My Classes & Students ({students.length})</h3>{myClasses.map(c=><div key={c.id} className="mb-4"><p className="font-bold text-orange-400">{c.name}</p><div className="mt-2 space-y-1">{students.filter(s=>s.class_id===c.id).map(s=><div key={s.id} className="bg-black/40 border border-white/5 p-2.5 rounded-xl text-sm flex justify-between"><span>{s.email} • {s.full_name}</span><span className={`text-xs px-2 py-1 rounded-full ${s.is_active?'bg-green-500/20 text-green-400':'bg-orange-500/20 text-orange-400'}`}>{s.is_active?'Active':'Pending'}</span></div>)}{students.filter(s=>s.class_id===c.id).length===0 && <p className="text-xs text-zinc-600">No students in this class yet</p>}</div>)}</div>
        <div className="bg-zinc-900/70 border border-orange-500/20 p-6 rounded-[24px]"><h3 className="font-black mb-4">Create Assignment for My Class</h3>
          <div className="space-y-3"><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Assignment Title" className="w-full bg-black border border-white/10 p-3.5 rounded-2xl"/><div className="grid grid-cols-2 gap-3"><input value={form.course} onChange={e=>setForm({...form,course:e.target.value})} placeholder="Course" className="bg-black border border-white/10 p-3.5 rounded-2xl"/><select value={form.class_id} onChange={e=>setForm({...form,class_id:e.target.value})} className="bg-black border border-white/10 p-3.5 rounded-2xl"><option value="">Select My Class</option>{myClasses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div><input type="datetime-local" value={form.due_date} onChange={e=>setForm({...form,due_date:e.target.value})} className="w-full bg-black border border-white/10 p-3.5 rounded-2xl"/><input type="file" onChange={e=>setForm({...form,file:e.target.files[0]})} className="w-full text-sm file:bg-orange-600 file:text-white file:border-0 file:px-4 file:py-2 file:rounded-xl bg-black border border-white/10 p-2 rounded-2xl"/><button onClick={async()=>{ if(!form.title||!form.class_id) return alert('Select class & title'); let url=null; if(form.file){ const path=`${Date.now()}_${form.file.name}`; await supabase.storage.from('mars-files').upload(path,form.file); url=supabase.storage.from('mars-files').getPublicUrl(path).data.publicUrl } await supabase.from('assignments').insert({title:form.title,course:form.course,due_date:form.due_date,class_id:form.class_id,attachment_url:url}); alert('Published!'); setForm({title:"",course:"",due_date:"",class_id:"",file:null})}} className="w-full bg-orange-600 py-3.5 rounded-2xl font-black">Publish to Students</button></div>
          <div className="mt-6"><h4 className="font-bold text-sm mb-2">My Assignments</h4>{assignments.map(a=><div key={a.id} className="bg-black/40 border border-white/5 p-2.5 rounded-xl text-sm flex justify-between mb-2"><span>{a.title} • {a.classes?.name}</span>{a.attachment_url && <a href={a.attachment_url} target="_blank" className="text-orange-400 underline">File</a>}</div>)}</div>
        </div>
      </div>
    </div>
  )
}

// ========== STUDENT ==========
function StudentDash({user, profile}){
  const [classInfo,setClassInfo]=useState(null); const [faculty,setFaculty]=useState(null); const [assignments,setAssignments]=useState([]); const [classmates,setClassmates]=useState([])
  useEffect(()=>{
    (async()=>{
      if(profile.class_id){ const {data:c}=await supabase.from('classes').select('*, users!classes_faculty_id_fkey(email,full_name)').eq('id',profile.class_id).single(); if(c){ setClassInfo(c); setFaculty(c.users) } const {data:u}=await supabase.from('users').select('email,full_name').eq('class_id',profile.class_id).eq('role','student'); if(u) setClassmates(u); const {data:a}=await supabase.from('assignments').select('*').or(`class_id.eq.${profile.class_id},class_id.is.null`).order('due_date',{ascending:true}); if(a) setAssignments(a) } else { const {data:a}=await supabase.from('assignments').select('*').is('class_id',null).order('due_date'); if(a) setAssignments(a) }
    })()
  },[])
  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="bg-zinc-900/70 border border-white/10 p-5 rounded-[20px]"><p className="text-xs uppercase text-zinc-500">My Class</p><p className="text-xl font-black text-orange-400">{classInfo?.name||'Not assigned yet'}</p><p className="text-xs text-zinc-400 mt-1">Contact super_admin to assign class</p></div>
        <div className="bg-zinc-900/70 border border-white/10 p-5 rounded-[20px]"><p className="text-xs uppercase text-zinc-500">My Faculty</p><p className="text-xl font-black">{faculty?.full_name||faculty?.email||'Unassigned'}</p><p className="text-xs text-zinc-400">{faculty?.email||''}</p></div>
        <div className="bg-zinc-900/70 border border-white/10 p-5 rounded-[20px]"><p className="text-xs uppercase text-zinc-500">Classmates</p><p className="text-3xl font-black">{classmates.length}</p></div>
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-zinc-900/70 border border-white/10 p-6 rounded-[24px]"><h3 className="font-black mb-4">My Assignments {classInfo? `— ${classInfo.name}`:''}</h3><div className="space-y-3">{assignments.length===0 && <p className="text-zinc-500 text-sm">No assignments yet for your class</p>}{assignments.map(a=><div key={a.id} className="bg-black/50 border border-white/5 p-4 rounded-2xl flex justify-between items-center"><div><p className="font-bold">{a.title}</p><p className="text-xs text-zinc-400">{a.course} • Due {a.due_date? new Date(a.due_date).toLocaleString():''}</p></div>{a.attachment_url? <a href={a.attachment_url} target="_blank" className="bg-orange-600 px-4 py-2 rounded-full text-xs font-bold">Download File</a> : <span className="text-xs text-zinc-600">No file</span>}</div>)}</div></div>
        <div className="bg-zinc-900/70 border border-white/10 p-6 rounded-[24px]"><h3 className="font-black mb-4">Classmates in {classInfo?.name||'—'}</h3><div className="space-y-2 max-h-[400px] overflow-auto">{classmates.map(m=><div key={m.email} className="bg-black/40 p-3 rounded-xl text-sm border border-white/5">{m.full_name||m.email}<p className="text-xs text-zinc-500">{m.email}</p></div>)}</div></div>
      </div>
    </div>
  )
}

// ========== WRAPPER ==========
export default function AppWrapper(){
  const [user,setUser]=useState(null), [profile,setProfile]=useState(null), [loading,setLoading]=useState(true)
  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{ if(data.session) setUser(data.session.user); setLoading(false) })
    supabase.auth.onAuthStateChange((_,s)=>{ setUser(s?.user||null); setLoading(false) })
  },[])
  useEffect(()=>{
    if(!user) return
    supabase.from('users').select('*').eq('id',user.id).single().then(({data})=>{
      if(!data){
        const isSuper = user.email==='admin1@mars.com'
        supabase.from('users').insert({id:user.id,email:user.email,role: isSuper?'super_admin': user.user_metadata?.role||'student', full_name:user.user_metadata?.full_name||'', is_active: isSuper}).select().single().then(({data:d})=>setProfile(d||{role:'student',is_active:false}))
      } else setProfile(data)
    })
  },[user])

  if(loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading MARS...</div>

  if(!user) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-900/30 via-black to-black">
      <div className="bg-zinc-900/80 backdrop-blur-2xl p-8 rounded-[32px] w-full max-w-md border border-white/10">
        <h1 className="text-4xl font-black mb-1"><span className="text-orange-500">MARS</span> E-School</h1><p className="text-zinc-500 text-sm mb-8">Modern Learning OS</p>
        <form onSubmit={async(e)=>{e.preventDefault(); const {error}=await supabase.auth.signInWithPassword({email:e.target.email.value,password:e.target.password.value}); if(error) alert(error.message)}} className="space-y-3">
          <input name="email" placeholder="Email" className="w-full bg-black border border-white/10 p-4 rounded-2xl" required/>
          <input name="password" type="password" placeholder="Password" className="w-full bg-black border border-white/10 p-4 rounded-2xl" required/>
          <button className="w-full bg-orange-600 p-4 rounded-2xl font-black">LOGIN</button>
        </form>
        <details className="mt-6"><summary className="text-zinc-400 text-sm cursor-pointer">Create account (needs approval)</summary>
          <form onSubmit={async(e)=>{e.preventDefault(); const {error}=await supabase.auth.signUp({email:e.target.email.value,password:e.target.password.value,options:{data:{full_name:e.target.fullname.value,[STRIPPED] if(error) alert(error.message); else alert('Created! Wait for admin approval')}} className="mt-3 space-y-2">
            <input name="fullname" placeholder="Full Name" className="w-full bg-black border border-white/10 p-3 rounded-2xl" required/>
            <input name="email" placeholder="Email" className="w-full bg-black border border-white/10 p-3 rounded-2xl" required/>
            <input name="password" type="password" placeholder="Password" className="w-full bg-black border border-white/10 p-3 rounded-2xl" required/>
            <select name="role" className="w-full bg-black border border-white/10 p-3 rounded-2xl"><option value="student">Student</option><option value="faculty">Faculty / Teacher</option><option value="parent">Parent</option></select>
            <button className="w-full bg-zinc-800 p-3 rounded-2xl">Sign Up</button>
          </form>
        </details>
      </div>
    </div>
  )

  let role = profile?.role || 'student'
  if(user.email==='admin1@mars.com') role='super_admin'
  const isActive = profile?.is_active || role==='super_admin'
  const isAdmin = ['super_admin','school_admin'].includes(role)
  const isFaculty = ['faculty','teacher'].includes(role)

  if(!isActive) return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 text-center"><div className="bg-zinc-900 border border-orange-500/20 p-10 rounded-[32px] max-w-md"><h2 className="text-2xl font-black mb-2">Access Pending ⏳</h2><p className="text-zinc-400">Hi {user.email}, your account as <b>{role}</b> is waiting for super_admin to approve and assign class.</p><button onClick={()=>supabase.auth.signOut()} className="mt-6 bg-zinc-800 px-6 py-3 rounded-full">Logout</button></div></div>
  )

  return (
    <div className="min-h-screen bg-[#080808] text-white p-4 md:p-8 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-900/20 via-black to-black">
      <header className="flex justify-between items-center mb-8 bg-zinc-900/60 backdrop-blur-xl p-3 pl-6 rounded-full border border-white/10">
        <h1 className="text-xs md:text-sm font-black tracking-wide"><span className="text-orange-500">MARS</span> • {user.email} • <span className="bg-white text-black px-2.5 py-1 rounded-full text-[10px]">{role.toUpperCase()}</span> {profile?.class_id && <span className="hidden md:inline text-zinc-500">• Class: {profile.class_id.slice(0,4)}...</span>}</h1>
        <button onClick={()=>supabase.auth.signOut()} className="bg-white text-black px-5 py-2 rounded-full font-bold text-sm">Logout</button>
      </header>
      {isAdmin? <AdminDash/> : isFaculty? <FacultyDash user={user} profile={profile}/> : <StudentDash user={user} profile={profile}/>}
    </div>
  )
}