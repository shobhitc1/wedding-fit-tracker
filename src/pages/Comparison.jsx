import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { db } from '../db.js'

const START_DATE = new Date(2026, 7, 23) // Sunday, Aug 23, 2026
const END_DATE = new Date(2026, 10, 25) // Nov 25, 2026 (wedding)
const DAY_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const REST_DAYS = ['Wednesday', 'Saturday']

function formatDateStr(date) {
  return date.toISOString().split('T')[0]
}

function formatDayLabel(date) {
  const dayName = DAY_ORDER[date.getDay()]
  const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${dayName}, ${monthDay}`
}

export default function Comparison({ logs, exercises }) {
  const [editingLog, setEditingLog] = useState(null)
  const [editValues, setEditValues] = useState({})

  // Build list of all weeks from START_DATE to END_DATE
  const allWeeks = useMemo(() => {
    const weeks = []
    let weekStart = new Date(START_DATE)
    let weekNum = 1
    while (weekStart <= END_DATE) {
      weeks.push({ weekNumber: weekNum, startDate: new Date(weekStart) })
      weekStart.setDate(weekStart.getDate() + 7)
      weekNum++
    }
    return weeks
  }, [])

  // Default to the week containing today, else week 1
  const defaultWeekIndex = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const idx = allWeeks.findIndex(w => {
      const weekEnd = new Date(w.startDate)
      weekEnd.setDate(weekEnd.getDate() + 6)
      return today >= w.startDate && today <= weekEnd
    })
    return idx !== -1 ? idx : 0
  }, [allWeeks])

  const [selectedWeekIdx, setSelectedWeekIdx] = useState(defaultWeekIndex)

  // Build a lookup of logs by id for fast access
  const logsById = useMemo(() => {
    const map = {}
    logs.forEach(log => {
      map[log.id] = log
    })
    return map
  }, [logs])

  // Build the days for the selected week
  const selectedWeekDays = useMemo(() => {
    const week = allWeeks[selectedWeekIdx]
    if (!week) return []

    const days = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(week.startDate)
      date.setDate(date.getDate() + i)
      if (date > END_DATE) break

      const dayName = DAY_ORDER[date.getDay()]
      const dateStr = formatDateStr(date)
      const isRest = REST_DAYS.includes(dayName)

      let rows = []
      if (!isRest) {
        const dayExercises = exercises[dayName] || []
        dayExercises.forEach(ex => {
          for (let setNum = 1; setNum <= 3; setNum++) {
            const logId = `${dateStr}-${ex.name}-${setNum}`
            const existing = logsById[logId]
            rows.push({
              id: logId,
              date: dateStr,
              exerciseName: ex.name,
              setNum,
              weight: existing?.weight ?? 0,
              reps: existing?.reps ?? 0,
              done: existing?.done ?? false
            })
          }
        })
      }

      days.push({ date, dateStr, dayName, isRest, rows, label: formatDayLabel(date) })
    }
    return days
  }, [allWeeks, selectedWeekIdx, exercises, logsById])

  // Group logs by exercise and week (for graph)
  const groupedData = useMemo(() => {
    const grouped = {}
    logs.forEach(log => {
      if (!grouped[log.exerciseName]) grouped[log.exerciseName] = {}
      const logDate = new Date(log.date)
      const weekStart = new Date(logDate)
      weekStart.setDate(logDate.getDate() - logDate.getDay())
      const weekKey = weekStart.toISOString().split('T')[0]
      if (!grouped[log.exerciseName][weekKey]) grouped[log.exerciseName][weekKey] = []
      grouped[log.exerciseName][weekKey].push(log)
    })
    return grouped
  }, [logs])

  const volumeData = useMemo(() => {
    const data = {}
    Object.entries(groupedData).forEach(([exerciseName, weeks]) => {
      data[exerciseName] = []
      Object.entries(weeks)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([week, logsInWeek]) => {
          const totalVolume = logsInWeek.reduce((sum, log) => sum + (log.weight * log.reps), 0)
          data[exerciseName].push({ week: week.split('-').slice(1).join('-'), volume: totalVolume })
        })
    })
    return data
  }, [groupedData])

  const chartData = useMemo(() => {
    if (Object.keys(volumeData).length === 0) return []
    const weeks = new Set()
    Object.values(volumeData).forEach(exWeeks => exWeeks.forEach(item => weeks.add(item.week)))
    const sortedWeeks = Array.from(weeks).sort()
    return sortedWeeks.map(week => {
      const dataPoint = { week }
      Object.entries(volumeData).forEach(([exerciseName, exWeeks]) => {
        const weekData = exWeeks.find(w => w.week === week)
        dataPoint[exerciseName] = weekData?.volume || 0
      })
      return dataPoint
    })
  }, [volumeData])

  const percentageChange = useMemo(() => {
    const changes = []
    Object.entries(volumeData).forEach(([exerciseName, weeks]) => {
      if (weeks.length >= 2) {
        const lastWeek = weeks[weeks.length - 1]
        const prevWeek = weeks[weeks.length - 2]
        const change = prevWeek.volume === 0 ? '0.0' : ((lastWeek.volume - prevWeek.volume) / prevWeek.volume * 100).toFixed(1)
        changes.push({ exercise: exerciseName, lastWeek: lastWeek.volume, prevWeek: prevWeek.volume, changePercent: change })
      }
    })
    return changes
  }, [volumeData])

  const handleEditLog = (row) => {
    setEditingLog(row)
    setEditValues({ weight: row.weight, reps: row.reps })
  }

  const handleSaveEdit = async () => {
    if (!editingLog) return

    await db.logs.put({
      id: editingLog.id,
      date: editingLog.date,
      exerciseName: editingLog.exerciseName,
      setNum: editingLog.setNum,
      weight: editValues.weight,
      reps: editValues.reps,
      done: editingLog.done,
      timestamp: new Date().toISOString()
    })

    setEditingLog(null)
    window.location.reload()
  }

  const colors = ['#00d9a3', '#00a3d9', '#d9a300', '#a300d9', '#d90000']

  return (
    <div className="comparison-page">
      <h1>Your Progress</h1>

      {/* Volume Trend Graph */}
      <div className="chart-container">
        <h2>Volume Trend (Weight × Reps)</h2>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="week" stroke="#888" />
              <YAxis stroke="#888" />
              <Tooltip contentStyle={{ backgroundColor: '#2a2a2a', border: '1px solid #444' }} />
              <Legend />
              {Object.keys(volumeData).map((exerciseName, idx) => (
                <Line
                  key={exerciseName}
                  type="monotone"
                  dataKey={exerciseName}
                  stroke={colors[idx % colors.length]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="no-data">No data yet. Start logging your workouts!</p>
        )}
      </div>

      {/* Percentage Change Table */}
      <div className="table-container">
        <h2>Week-over-Week % Change</h2>
        {percentageChange.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Exercise</th>
                <th>Last Week</th>
                <th>Prev Week</th>
                <th>Change %</th>
              </tr>
            </thead>
            <tbody>
              {percentageChange.map((item, idx) => (
                <tr key={idx}>
                  <td>{item.exercise}</td>
                  <td>{Math.round(item.lastWeek)}</td>
                  <td>{Math.round(item.prevWeek)}</td>
                  <td className={item.changePercent > 0 ? 'up' : 'down'}>
                    {item.changePercent > 0 ? '+' : ''}{item.changePercent}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="no-data">Not enough data yet.</p>
        )}
      </div>

      {/* Full Schedule Log Table with Week Dropdown */}
      <div className="table-container">
        <h2>All Logged Data</h2>

        <select
          value={selectedWeekIdx}
          onChange={(e) => setSelectedWeekIdx(Number(e.target.value))}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '16px',
            background: '#1a1a1a',
            color: '#e0e0e0',
            border: '0.5px solid #505050',
            borderRadius: '6px',
            marginBottom: '16px'
          }}
        >
          {allWeeks.map((w, idx) => (
            <option key={idx} value={idx}>
              Week {w.weekNumber} ({formatDateStr(w.startDate)})
            </option>
          ))}
        </select>

        {selectedWeekDays.map(day => (
          <div key={day.dateStr} style={{ marginBottom: '16px' }}>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: '14px', marginBottom: '6px' }}>
              {day.label}
            </div>

            {day.isRest ? (
              <p style={{ color: '#666', fontSize: '13px', padding: '8px 0' }}>Rest Day</p>
            ) : day.rows.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Exercise</th>
                    <th>Set</th>
                    <th>Weight (kg)</th>
                    <th>Reps</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {day.rows.map((row, idx) => (
                    <tr key={row.id}>
                      <td>{row.exerciseName}</td>
                      <td>{row.setNum}</td>
                      <td>{row.weight}</td>
                      <td>{row.reps}</td>
                      <td>
                        <button className="edit-log-btn" onClick={() => handleEditLog(row)}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: '#666', fontSize: '13px', padding: '8px 0' }}>No exercises set for this day.</p>
            )}
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editingLog && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Edit Log Entry</h3>
            <div className="modal-content">
              <label>
                Weight (kg):
                <input
                  type="number"
                  value={editValues.weight}
                  onChange={(e) => setEditValues({ ...editValues, weight: parseFloat(e.target.value) || 0 })}
                  className="modal-input"
                />
              </label>
              <label>
                Reps:
                <input
                  type="number"
                  value={editValues.reps}
                  onChange={(e) => setEditValues({ ...editValues, reps: parseFloat(e.target.value) || 0 })}
                  className="modal-input"
                />
              </label>
            </div>
            <div className="modal-buttons">
              <button className="save-btn" onClick={handleSaveEdit}>Save</button>
              <button className="cancel-btn" onClick={() => setEditingLog(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
