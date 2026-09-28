import { useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured, logAccess, supabase } from './superbase'

const FALLBACK_ASSIGNMENTS = [
  { id: 1, title: 'Mars Atmosphere Analysis', course: 'PHYS 220', due: new Date(Date.now() + 28 * 3600 * 1000), max: 100, status: 'pending' },
  { id: 2, title: 'Orbital Calculations - Problem Set 5', course: 'MATH 104', due: new Date(Date.now() + 84 * 3600 * 1000), max: 50, status: 'pending' },
]

function nextClassAt() {
  const target = new Date()
  target.setHours(15, 30, 0, 0)
  if (target.getTime() <= Date.now()) target.setDate(target.getDate() + 1)
  return target
}

function formatRemaining(diff) {
  if (diff <= 0) return '00 : 00 : 00'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(h)} : ${pad(m)} : ${pad(s)}`
}

function normalizeAssignment(row) {
  const dueValue = row.due instanceof Date ? row.due : new Date(row.due || row.due_date)
  return {
    id: row.id,
    title: row.title,
    course: row.course || 'PHYS 220',
    due: Number.isNaN(dueValue.getTime()) ? new Date() : dueValue,
    max: row.max ?? row.max_marks ?? 100,
    status: row.status || 'pending',
  }
}

function Countdown({ due }) {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    const update = () => {
      const diff = due - new Date()
      if (diff <= 0) {
        setTimeLeft('CLOSED')
        return
      }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      setTimeLeft(`${h}h ${m}m left`)
    }
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [due])

  const isUrgent = due - new Date() < 24 * 3600 * 1000
  return <span className={isUrgent ? 'text-red-400 font-bold' : 'text-orange-400'}>{timeLeft}</span>
}

function StudentDashboard({ user, assignments }) {
  const nextClass = { subject: 'CALC II — Limits & Derivatives', time: '15:30', room: 'Virtual Lab M-302' }
  const [classLeft, setClassLeft] = useState(() => formatRemaining(nextClassAt() - Date.now()))

  useEffect(() => {
    const timer = setInterval(() => {
      setClassLeft(formatRemaining(nextClassAt() - Date.now()))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const displayName = user?.user_metadata?.full_name || user?.email || 'Student'

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-zinc-900 p-6 rounded-2xl border border-orange-500/20">
          <h3 className="text-orange-400">My Courses</h3>
          <p className="text-sm text-zinc-400 mt-1">Welcome back, {displayName}</p>
          <div className="mt-4 space-y-3">
            <div>
              <p>PHYS 220 • Physics of Mars</p>
              <div className="w-full bg-zinc-800 h-2 rounded">
                <div className="bg-orange-500 h-2 w-[67%] rounded"></div>
              </div>
            </div>
            <div>
              <p>MATH 104 • Orbital Mechanics</p>
              <div className="w-full bg-zinc-800 h-2 rounded">
                <div className="bg-orange-500 h-2 w-[50%] rounded"></div>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-zinc-900 p-6 rounded-2xl border border-orange-500/20">
          <h3>Next Class Countdown</h3>
          <p className="text-5xl font-bold text-orange-400 my-3">{classLeft}</p>
          <p>{nextClass.subject} • {nextClass.time} • {nextClass.room}</p>
          <button type="button" className="mt-4 w-full bg-orange-600 py-2 rounded-lg">Join Class Now</button>
        </div>
        <div className="bg-zinc-900 p-6 rounded-2xl border border-orange-500/20">
          <h3>School Fees Balance</h3>
          <p className="text-4xl font-bold mt-2">$1,250.00</p>
          <p className="text-sm text-zinc-400">Outstanding for Fall 2024</p>
          <div className="w-full bg-zinc-800 h-2 rounded mt-3">
            <div className="bg-orange-500 h-2 w-[68%] rounded"></div>
          </div>
        </div>
      </div>

      <div className="bg-zinc-900 p-6 rounded-2xl border border-orange-500/20">
        <h2 className="text-orange-400 mb-4">Time-Sensitive Assignments</h2>
        {assignments.length === 0 && <p className="text-zinc-400">No assignments yet.</p>}
        {assignments.map((a) => (
          <div key={a.id} className="flex justify-between py-3 border-b border-zinc-800 gap-4">
            <div>
              <p>{a.title}</p>
              <p className="text-sm text-zinc-400">{a.course} • due {a.due.toLocaleString()}</p>
            </div>
            <Countdown due={a.due} />
          </div>
        ))}
      </div>
    </div>
  )
}

function FacultyDashboard({ assignments, onPublish, onSaveMark }) {
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [marks, setMarks] = useState({})

  const addAssignment = async () => {
    if (!title.trim() || !dueDate) {
      alert('Add a title and due date first.')
      return
    }
    await onPublish({ title: title.trim(), dueDate })
    setTitle('')
    setDueDate('')
  }

  const saveMark = async (assignment) => {
    const row = marks[assignment.id] || {}
    if (!row.studentId || !row.mark) {
      alert('Enter a student ID and mark.')
      return
    }
    await onSaveMark({ assignment, studentId: row.studentId, mark: row.mark })
    setMarks((prev) => ({ ...prev, [assignment.id]: { studentId: '', mark: '' } }))
  }

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 p-6 rounded-2xl border border-orange-500/20">
        <h2 className="text-xl mb-4">Create Time-Sensitive Assignment</h2>
        <div className="flex flex-col md:flex-row gap-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Assignment Title" className="flex-1 bg-zinc-800 p-2 rounded" />
          <input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="bg-zinc-800 p-2 rounded" />
          <button type="button" onClick={addAssignment} className="bg-orange-600 px-6 py-2 rounded">Publish</button>
        </div>
      </div>
      <div className="bg-zinc-900 p-6 rounded-2xl border border-orange-500/20">
        <h3>Allocate Marks</h3>
        {assignments.map((a) => (
          <div key={a.id} className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-zinc-800 py-3 gap-3">
            <span>{a.title} - <Countdown due={a.due} /></span>
            <div className="flex gap-2">
              <input
                placeholder="Student ID"
                className="bg-zinc-800 w-24 p-1 rounded"
                value={marks[a.id]?.studentId || ''}
                onChange={(e) => setMarks((prev) => ({ ...prev, [a.id]: { ...prev[a.id], studentId: e.target.value } }))}
              />
              <input
                placeholder="Mark"
                className="bg-zinc-800 w-16 p-1 rounded"
                value={marks[a.id]?.mark || ''}
                onChange={(e) => setMarks((prev) => ({ ...prev, [a.id]: { ...prev[a.id], mark: e.target.value } }))}
              />
              <button type="button" onClick={() => saveMark(a)} className="bg-green-600 px-3 rounded">Save</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AccessLogs({ logs }) {
  return (
    <div className="bg-zinc-900 p-6 rounded-2xl border border-orange-500/20">
      <h2 className="text-orange-400 mb-4">Access Logs - Who Opened System</h2>
      <div className="space-y-2 max-h-[300px] overflow-auto text-sm">
        {logs.length === 0 && <p className="text-zinc-400">No access logs yet.</p>}
        {logs.map((l) => (
          <div key={l.id} className="text-zinc-400">
            <b className="text-white">{l.email}</b> ({l.role})<br />
            {new Date(l.login_time).toLocaleString()}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [view, setView] = useState('student')
  const [assignments, setAssignments] = useState(FALLBACK_ASSIGNMENTS)
  const [logs, setLogs] = useState([])

  const accountRole = user?.user_metadata?.role === 'faculty' ? 'faculty' : 'student'

  const fetchAssignments = async () => {
    if (!isSupabaseConfigured) return
    const { data, error } = await supabase.from('assignments').select('*').order('due_date')
    if (!error && data?.length) setAssignments(data.map(normalizeAssignment))
  }

  const fetchLogs = async () => {
    if (!isSupabaseConfigured) return
    const { data } = await supabase.from('access_logs').select('*').order('login_time', { ascending: false }).limit(50)
    if (data) setLogs(data)
  }

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setUser(data.session.user)
        setView(data.session.user.user_metadata?.role === 'faculty' ? 'faculty' : 'student')
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user)
        setView(session.user.user_metadata?.role === 'faculty' ? 'faculty' : 'student')
        if (event === 'SIGNED_IN') logAccess(session.user)
      } else {
        setUser(null)
      }
    })
    fetchAssignments()
    fetchLogs()
    return () => subscription.unsubscribe()
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    const email = e.target.email.value
    const password = e.target.password.value
    if (!isSupabaseConfigured) {
      alert('Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable login, or use Preview dashboards.')
      return
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) alert(error.message)
  }

  const handleSignup = async (e) => {
    e.preventDefault()
    const email = e.target.email.value
    const password = e.target.password.value
    const full_name = e.target.fullname.value
    const role = e.target.role.value
    if (!isSupabaseConfigured) {
      alert('Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable signup, or use Preview dashboards.')
      return
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name, role } },
    })
    if (error) {
      alert(error.message)
      return
    }
    if (data.user) {
      await supabase.from('users').insert({
        id: data.user.id,
        email,
        full_name,
        role,
        student_id: role === 'student' ? `STU${Date.now().toString().slice(-4)}` : `FAC${Date.now().toString().slice(-4)}`,
        course: 'Computer Science',
      })
    }
    alert('Account created! Now login.')
  }

  const publishAssignment = async ({ title, dueDate }) => {
    const due = new Date(dueDate)
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('assignments').insert({
        title,
        course: 'PHYS 220',
        due_date: due.toISOString(),
        max: 100,
        status: 'active',
      }).select()

      if (!error && data?.[0]) {
        setAssignments((prev) => [...prev, normalizeAssignment(data[0])])
        return
      }
    }

    setAssignments((prev) => [...prev, {
      id: Date.now(),
      title,
      course: 'PHYS 220',
      due,
      max: 100,
      status: 'active',
    }])
  }

  const saveMark = async ({ assignment, studentId, mark }) => {
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('grades').insert({
        assignment_id: assignment.id,
        student_id: studentId,
        mark: Number(mark),
      })
      if (!error) {
        alert(`Saved ${mark} for ${studentId}`)
        return
      }
    }
    alert(`Saved locally: ${studentId} scored ${mark}/${assignment.max} on ${assignment.title}`)
  }

  const sortedAssignments = useMemo(
    () => [...assignments].sort((a, b) => a.due - b.due),
    [assignments],
  )

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-zinc-900 p-8 rounded-2xl w-full max-w-md border border-orange-500/20">
          <h1 className="text-3xl font-bold text-white mb-6"><span className="text-orange-500">MARS</span> E-School</h1>
          <form onSubmit={handleLogin} className="space-y-3">
            <input name="email" placeholder="Email" className="w-full bg-zinc-800 p-3 rounded text-white" required />
            <input name="password" type="password" placeholder="Password" className="w-full bg-zinc-800 p-3 rounded text-white" required />
            <button className="w-full bg-orange-600 p-3 rounded font-bold text-white">LOGIN</button>
          </form>
          <details className="mt-6">
            <summary className="text-zinc-400 cursor-pointer">Create new account</summary>
            <form onSubmit={handleSignup} className="mt-3 space-y-2">
              <input name="fullname" placeholder="Full Name" className="w-full bg-zinc-800 p-2 rounded text-white" required />
              <input name="email" placeholder="Email" className="w-full bg-zinc-800 p-2 rounded text-white" required />
              <input name="password" type="password" placeholder="Password" className="w-full bg-zinc-800 p-2 rounded text-white" required />
              <select name="role" className="w-full bg-zinc-800 p-2 rounded text-white">
                <option value="student">Student</option>
                <option value="faculty">Faculty</option>
              </select>
              <button className="w-full bg-zinc-700 p-2 rounded text-white">Sign Up</button>
            </form>
          </details>
          <button
            type="button"
            className="w-full mt-4 text-sm text-zinc-400 hover:text-orange-400"
            onClick={() => {
              setUser({ email: 'alex@mars.edu', user_metadata: { full_name: 'Alex', role: 'student' } })
              setView('student')
            }}
          >
            Preview dashboards
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 font-sans">
      <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
        <h1 className="text-2xl font-bold">
          <span className="text-orange-500">MARS</span> E-School
          <span className="block md:inline md:ml-3 text-base font-normal text-zinc-400">
            {user.user_metadata?.full_name || user.email} • {accountRole}
          </span>
        </h1>
        <div className="flex gap-2">
          <button type="button" onClick={() => setView('student')} className={`px-4 py-1 rounded ${view === 'student' ? 'bg-orange-600' : 'bg-zinc-800'}`}>Student View</button>
          <button type="button" onClick={() => setView('faculty')} className={`px-4 py-1 rounded ${view === 'faculty' ? 'bg-orange-600' : 'bg-zinc-800'}`}>Faculty View</button>
          <button type="button" onClick={() => supabase.auth.signOut()} className="bg-zinc-800 px-4 py-1 rounded">Logout</button>
        </div>
      </header>

      {view === 'student'
        ? <StudentDashboard user={user} assignments={sortedAssignments} />
        : <FacultyDashboard assignments={sortedAssignments} onPublish={publishAssignment} onSaveMark={saveMark} />}

      <div className="mt-6">
        <AccessLogs logs={logs} />
      </div>
    </div>
  )
}
