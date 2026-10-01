import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)

const sanitizeInput = (str) => {
  if (!str) return ""
  let s = String(str).trim().slice(0, 254)
  s = s.split("<").join("").split(">").join("")
  return s
}

function AppWrapper(){
  const [user,setUser]=useState(null)
  const [profile,setProfile]=useState(null)
  const [loading,setLoading]=useState(true)
  const [mode,setMode]=useState("login")
  const [form,setForm]=useState({email:"",password:"",full_name:"",role:"student"})
  const [submitting,setSubmitting]=useState(false)

  useEffect(()=>{
    supabase.auth.getSession().then((res)=>{
      const sess = res.data.session
      setUser(sess?.user||null)
      if(sess?.user) fetchProfile(sess.user.id)
      else setLoading(false)
    })
    const listener = supabase.auth.onAuthStateChange((e, sess)=>{
      setUser(sess?.user||null)
      if(sess?.user) fetchProfile(sess.user.id)
      else { setProfile(null); setLoading(false)}
    })
    return ()=>{ listener.data.subscription.unsubscribe() }
  },[])

  const fetchProfile=async(uid)=>{
    const res=await supabase.from('users').select('*').eq('id',uid).single()
    setProfile(res.data||null); setLoading(false)
  }

  const handleAuth=async(e)=>{
    e.preventDefault()
    if(submitting) return
    setSubmitting(true)
    try{
      const cleanEmail=sanitizeInput(form.email).toLowerCase()
      const cleanPassword=form.password.trim().slice(0,72)
      const cleanName=sanitizeInput(form.full_name).slice(0,50)
      if(mode==="signup"){
        const res=await supabase.auth.signUp({email:cleanEmail,password:cleanPassword,options:{data:{full_name:cleanName}}})
        if(res.error) throw res.error
        await supabase.from('users').insert({id:res.data.user.id,email:cleanEmail,full_name:cleanName,role:form.role,is_active:false})
        alert("Account created! Wait for Admin approval.")
        setMode("login")
      } else {
        const res=await supabase.auth.signInWithPassword({email:cleanEmail,password:cleanPassword})
        if(res.error) throw res.error
        const prof=await supabase.from('users').select('*').eq('id',res.data.user.id).single()
        if(prof.data &&!prof.data.is_active){ alert("Account pending approval"); await supabase.auth.signOut(); return }
        setUser(res.data.user); setProfile(prof.data)
      }
    }catch(err){ alert(err.message) }
    finally{ setSubmitting(false) }
  }

  const logout=async()=>{ await supabase.auth.signOut(); setUser(null); setProfile(null) }
  if(loading) return <div className="min-h-screen bg-[#080808] flex items-center justify-center text-white">Loading MARS...</div>
  if(!user) return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#080808]">
      <div className="p-6 rounded-[24px] w-full max-w-[400px] border border-white/10 bg-[#18181b]">
        <h2 className="text-2xl font-black text-white mb-4">{mode==="login"?"Login":"Sign Up"}</h2>
        <form onSubmit={handleAuth} className="space-y-3">
          <input value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} placeholder="Email" className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white"/>
          <input value={form.password} onChange={(e)=>setForm({...form,password:e.target.value})} placeholder="Password" type="password" className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white"/>
          {mode==="signup" && <>
            <input value={form.full_name} onChange={(e)=>setForm({...form,full_name:e.target.value})} placeholder="Full Name" className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white"/>
            <select value={form.role} onChange={(e)=>setForm({...form,role:e.target.value})} className="w-full bg-zinc-800 border border-white/10 p-3.5 rounded-2xl text-white"><option value="student">Student</option><option value="faculty">Faculty</option><option value="parent">Parent</option></select>
          </>}
          <button disabled={submitting} type="submit" className="w-full bg-orange-600 py-3.5 rounded-2xl font-black text-white">{submitting?"Wait...":mode==="login"?"Login":"Sign Up"}</button>
        </form>
        <p className="text-center text-sm text-zinc-400 mt-4"><button onClick={()=>setMode(mode==="login"?"signup":"login")} className="text-orange-400 font-bold">{mode==="login"?"Sign Up":"Login"}</button></p>
      </div>
    </div>
  )
  const role=(profile?.role||'').toLowerCase().trim()
  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <header className="sticky top-0 z-50 bg-black/90 backdrop-blur border-b border-white/10 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2"><div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center font-black">M</div><span className="font-black">MARS</span><span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full ml-2">{profile?.role}</span></div>
        <button onClick={logout} className="bg-zinc-800 px-3 py-1.5 rounded-full text-xs">Logout {profile?.email}</button>
      </header>
      <main className="p-3 md:p-6">
        {role==="super_admin" || role==="school_admin" || role==="admin"? <AdminDash profile={profile} /> : null}
        {role==="faculty" || role==="teacher"? <FacultyDash profile={profile} /> : null}
        {role==="student"? <StudentDash profile={profile} /> : null}
      </main>
    </div>
  )
}

function AdminDash({profile}){
  const [users,setUsers]=useState([]); const [classes,setClasses]=useState([])
  const [classForm,setClassForm]=useState({name:"",faculty_id:"",student_ids:[]})
  const load=async()=>{
    const u=await supabase.from('users').select('*'); if(u.data) setUsers(u.data)
    const c=await supabase.from('classes').select('*'); if(c.data) setClasses(c.data)
  }
  useEffect(()=>{load()},[])
  const facultyList=users.filter((u)=>["faculty","teacher"].includes((u.role||'').toLowerCase()))
  const studentList=users.filter((u)=>(u.role||'').toLowerCase()==="student")
  return (
    <div className="max-w-[1300px] mx-auto space-y-4">
      <h2 className="font-black">Admin - Classes: {classes.length}</h2>
      <div className="bg-zinc-900/70 border border-white/10 p-4 rounded-[24px]">
        <input value={classForm.name} onChange={(e)=>setClassForm({...classForm,name:e.target.value})} placeholder="Class name e.g Geo" className="w-full bg-zinc-800 border border-white/10 p-3 rounded-2xl mb-2 text-white"/>
        <select value={classForm.faculty_id} onChange={(e)=>setClassForm({...classForm,faculty_id:e.target.value})} className="w-full bg-zinc-800 border border-white/10 p-3 rounded-2xl mb-2 text-white"><option value="">Select Faculty</option>{facultyList.map((f)=><option key={f.id} value={f.id}>{f.email}</option>)}</select>
        <button onClick={async()=>{
          const res=await supabase.from('classes').insert({name:classForm.name,faculty_id:classForm.faculty_id||null}).select().single()
          if(classForm.student_ids.length>0) await supabase.from('users').update({class_id:res.data.id}).in('id',classForm.student_ids)
          setClassForm({name:"",faculty_id:"",student_ids:[]}); load()
        }} className="w-full bg-orange-600 py-3 rounded-2xl font-black">Create Class</button>
        <div className="grid grid-cols-2 gap-2 mt-3 max-h-[200px] overflow-auto">{studentList.map((s)=><label key={s.id} className="flex gap-2 text-xs"><input type="checkbox" checked={classForm.student_ids.includes(s.id)} onChange={()=>setClassForm((p)=>({...p,student_ids:p.student_ids.includes(s.id)?p.student_ids.filter((x)=>x!==s.id):[...p.student_ids,s.id]}))}/>{s.email}</label>)}</div>
      </div>
      <div className="grid gap-2">{classes.map((c)=>{
        const fac=users.find((u)=>u.id===c.faculty_id)
        const studs=users.filter((u)=>u.class_id===c.id)
        return <div key={c.id} className="bg-zinc-900/70 border border-white/10 p-4 rounded-2xl"><p className="font-black">{c.name} - {fac?fac.email:"No faculty"} - {studs.length} students</p><div className="flex flex-wrap gap-1 mt-2">{studs.map((s)=><span key={s.id} className="bg-black/50 border border-white/10 px-2 py-1 rounded-full text-[10px]">{s.email}</span>)}</div></div>
      })}</div>
    </div>
  )
}

// FIXED FACULTY - NO created_at ORDER, SHOWS ALL SUBMISSIONS
function FacultyDash({profile}){
  const [classes,setClasses]=useState([]); const [users,setUsers]=useState([])
  const [assignments,setAssignments]=useState([]); const [subs,setSubs]=useState([])
  const [tab,setTab]=useState("submissions")
  const [form,setForm]=useState({title:"",course:"",due_date:"",class_id:"",file:null})
  const [grades,setGrades]=useState({}); const [feedbacks,setFeedbacks]=useState({})
  const [debug,setDebug]=useState("Loading...")

  const load=async()=>{
    try{
      const cRes=await supabase.from('classes').select('*')
      const uRes=await supabase.from('users').select('*')
      const aRes=await supabase.from('assignments').select('*')

      if(cRes.data) setClasses(cRes.data)
      if(uRes.data) setUsers(uRes.data)
      if(aRes.data) setAssignments(aRes.data)

      // FIXED QUERY - no order by created_at, no column that doesn't exist
      const sRes=await supabase.from('submissions').select('*')
      let dbg = "DB raw submissions: "+(sRes.data?.length||0)+"\n"
      if(sRes.error) dbg += "ERROR: "+sRes.error.message+"\n"

      if(sRes.data && sRes.data.length>0){
        // Get details for each submission
        const enriched=[]
        for(let sub of sRes.data){
          const stu = (uRes.data||[]).find((u)=>u.id===sub.student_id)
          const ass = (aRes.data||[]).find((a)=>a.id===sub.assignment_id)
          enriched.push({...sub, _student:stu, _assignment:ass})
        }
        const myClassIds=(cRes.data||[]).filter((x)=>x.faculty_id===profile.id).map((x)=>x.id)
        dbg+="My class IDs: "+myClassIds.join(',')+"\n"
        dbg+="My students: "+(uRes.data||[]).filter((u)=>myClassIds.includes(u.class_id)).map((u)=>u.email).join(', ')+"\n"
        const filtered=enriched.filter((s)=>{
          const sc=s._student?.class_id
          const ac=s._assignment?.class_id
          return myClassIds.includes(sc) || myClassIds.includes(ac) || s._assignment?.created_by===profile.id
        })
        dbg+="Filtered for you: "+filtered.length+"\n"
        setSubs(filtered)
        setDebug(dbg)
      }else{
        setSubs([])
        setDebug(dbg+"No rows in submissions table - student hasn't submitted yet or table was empty")
      }
    }catch(e){ setDebug("Catch: "+e.message) }
  }

  useEffect(()=>{load()},[])

  const myClasses=classes.filter((c)=>c.faculty_id===profile.id)
  const myClassIds=myClasses.map((c)=>c.id)
  const myStudents=users.filter((u)=>myClassIds.includes(u.class_id))

  const saveGrade=async(sub)=>{
    const grade=grades[sub.id]||sub.grade||""
    const feedback=feedbacks[sub.id]||sub.feedback||""
    if(!grade &&!feedback) return alert("Enter grade or comment")
    const up=await supabase.from('submissions').update({grade:grade, feedback:feedback}).eq('id',sub.id)
    if(up.error) alert(up.error.message)
    else { alert("Saved!"); load() }
  }

  return (
    <div className="max-w-[1300px] mx-auto space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-zinc-900 p-4 rounded-xl"><p className="text-[10px] text-zinc-500">MY CLASSES</p><p className="text-2xl font-black">{myClasses.length}</p></div>
        <div className="bg-zinc-900 p-4 rounded-xl"><p className="text-[10px] text-zinc-500">MY STUDENTS</p><p className="text-2xl font-black">{myStudents.length}</p></div>
        <div className="bg-zinc-900 p-4 rounded-xl"><p className="text-[10px] text-zinc-500">ASSIGNMENTS</p><p className="text-2xl font-black">{assignments.filter((a)=>myClassIds.includes(a.class_id)||a.created_by===profile.id).length}</p></div>
        <div className="bg-zinc-900 p-4 rounded-xl border border-orange-500/20"><p className="text-[10px] text-zinc-500">SUBMISSIONS</p><p className="text-2xl font-black text-orange-400">{subs.length}</p></div>
      </div>

      <div className="bg-black/50 border border-white/10 p-3 rounded-xl text-[11px] font-mono whitespace-pre-wrap">{debug}</div>

      <div className="flex gap-2 bg-zinc-900 p-1 rounded-full">
        <button onClick={()=>setTab("submissions")} className={"px-4 py-2 rounded-full text-sm font-bold "+(tab==="submissions"?"bg-orange-600":"text-zinc-400")}>Submissions ({subs.length})</button>
        <button onClick={()=>setTab("create")} className={"px-4 py-2 rounded-full text-sm font-bold "+(tab==="create"?"bg-orange-600":"text-zinc-400")}>Create Assignment</button>
      </div>

      {tab==="create" && (
        <div className="bg-zinc-900 border border-white/10 p-6 rounded-[24px] max-w-[600px]">
          <h3 className="font-black mb-3">Create Assignment for {myClasses.map((c)=>c.name).join(', ')}</h3>
          <input value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})} placeholder="Title" className="w-full bg-zinc-800 border border-white/10 p-3 rounded-xl mb-2 text-white"/>
          <input value={form.course} onChange={(e)=>setForm({...form,course:e.target.value})} placeholder="Course" className="w-full bg-zinc-800 border border-white/10 p-3 rounded-xl mb-2 text-white"/>
          <select value={form.class_id} onChange={(e)=>setForm({...form,class_id:e.target.value})} className="w-full bg-zinc-800 border border-white/10 p-3 rounded-xl mb-2 text-white"><option value="">Select Class</option>{myClasses.map((c)=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <input type="datetime-local" value={form.due_date} onChange={(e)=>setForm({...form,due_date:e.target.value})} className="w-full bg-zinc-800 border border-white/10 p-3 rounded-xl mb-2 text-white"/>
          <button onClick={async()=>{
            if(!form.title||!form.due_date) return alert("Title + due date needed")
            const ins=await supabase.from('assignments').insert({title:form.title,course:form.course,due_date:form.due_date,class_id:form.class_id||myClassIds[0]||null,created_by:profile.id})
            if(ins.error) alert(ins.error.message)
            else { setForm({title:"",course:"",due_date:"",class_id:"",file:null}); load(); alert("Created!") }
          }} className="w-full bg-orange-600 py-3 rounded-xl font-black">Publish</button>
        </div>
      )}

      {tab==="submissions" && (
        <div className="bg-zinc-900/70 border border-white/10 rounded-[24px] p-6">
          <h3 className="font-black mb-4">Submissions Received ({subs.length}) - Grade + Comment</h3>
          <div className="grid lg:grid-cols-2 gap-3">
            {subs.map((s)=>(
              <div key={s.id} className="bg-black/60 border border-white/5 p-4 rounded-2xl">
                <p className="font-bold text-sm">{s._student?.email||s.student_id}</p>
                <p className="text-xs text-orange-400">{s._assignment?.title||s.assignment_id}</p>
                <a href={s.file_url} target="_blank" rel="noreferrer" className="inline-block mt-2 bg-zinc-800 px-3 py-1 rounded-full text-xs">View File</a>
                <div className="mt-3 space-y-2">
                  <div className="flex gap-2">
                    <input value={grades[s.id]||s.grade||''} onChange={(e)=>setGrades({...grades,[s.id]:e.target.value})} placeholder="Grade A, 85%" className="flex-1 bg-zinc-800 border border-white/10 p-2 rounded-xl text-sm text-white"/>
                    <button onClick={()=>saveGrade(s)} className="bg-orange-600 px-4 py-2 rounded-xl text-xs font-black">Save</button>
                  </div>
                  <textarea value={feedbacks[s.id]||s.feedback||''} onChange={(e)=>setFeedbacks({...feedbacks,[s.id]:e.target.value})} placeholder="Comment for student..." rows={2} className="w-full bg-zinc-800 border border-white/10 p-2 rounded-xl text-sm text-white"></textarea>
                  {s.grade && <p className="text-[11px] text-green-400">Current: Grade {s.grade} {s.feedback?" - "+s.feedback:""}</p>}
                </div>
              </div>
            ))}
            {subs.length===0 && <p className="text-zinc-500 col-span-2 text-center py-10">No submissions. After running SQL above, ask student to submit again. Then Refresh.</p>}
          </div>
          <button onClick={load} className="mt-4 bg-white text-black px-4 py-2 rounded-full text-xs font-black">Refresh</button>
        </div>
      )}
    </div>
  )
}

function StudentDash({profile}){
  const [assignments,setAssignments]=useState([]); const [mySubs,setMySubs]=useState([])
  useEffect(()=>{(async()=>{
    const a=await supabase.from('assignments').select('*'); if(a.data) setAssignments(a.data.filter((x)=>!profile.class_id || x.class_id===profile.class_id ||!x.class_id))
    const s=await supabase.from('submissions').select('*').eq('student_id',profile.id); if(s.data) setMySubs(s.data)
  })()},[profile])
  return (
    <div className="max-w-[900px] mx-auto space-y-3">
      <h3 className="font-black">My Assignments ({assignments.length})</h3>
      {assignments.map((a)=>{
        const sub=mySubs.find((s)=>s.assignment_id===a.id)
        return (
          <div key={a.id} className={"p-4 rounded-2xl border "+(sub?"border-green-500/30 bg-green-500/5":"border-white/10 bg-zinc-900/70")}>
            <p className="font-black">{a.title} - {a.course}</p>
            <p className="text-xs text-zinc-500">Due {a.due_date?new Date(a.due_date).toLocaleString():"No due"}</p>
            {sub && <div className="mt-2 bg-orange-500/10 p-2 rounded-xl"><p className="text-xs">Grade: <span className="font-black text-green-400">{sub.grade||"Not graded"}</span></p>{sub.feedback && <p className="text-xs mt-1">Comment: {sub.feedback}</p>}</div>}
            <div className="mt-3 flex gap-2">
              <label className="bg-zinc-800 px-3 py-2 rounded-xl text-xs cursor-pointer">{sub?"Resubmit":"Upload"}<input type="file" hidden onChange={async(e)=>{
                const file=e.target.files[0]; if(!file) return
                const path=profile.id+"/"+Date.now()+"_"+file.name
                const up=await supabase.storage.from('mars-files').upload(path,file)
                if(up.error) return alert(up.error.message)
                const url=supabase.storage.from('mars-files').getPublicUrl(path).data.publicUrl
                await supabase.from('submissions').insert({assignment_id:a.id,student_id:profile.id,file_url:url})
                alert("Submitted!")
              }}/></label>
              {sub && <a href={sub.file_url} target="_blank" rel="noreferrer" className="bg-white text-black px-3 py-2 rounded-xl text-xs font-bold">View Mine</a>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default AppWrapper