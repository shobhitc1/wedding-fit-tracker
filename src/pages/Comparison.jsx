import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { db } from '../db.js'

export default function Comparison({ logs, exercises }) {
  const [editingLog, setEditingLog] = useState(null)
  const [editValues, setEditValues] = useState({})

  // Group logs by exercise and week
  const groupedData = useMemo(() => {
    const grouped = {}

    logs.forEach(log => {
      if (!grouped[log.exerciseName]) {
        grouped[log.exerciseName] = {}
      }

      const logDate = new Date(log.date)
      const weekStart = new Date(logDate)
      weekStart.setDate(logDate.getDate() - logDate.getDay())
      const weekKey = weekStart.toISOString().split('T')[0]

      if (!grouped[log.exerciseName][weekKey]) {
        grouped[log.exerciseName][weekKey] = []
      }
      grouped[log.exerciseName][weekKey].push(log)
    })

    return grouped
  }, [logs])

  // Calculate volume per exercise per week
  const volumeData = useMemo(() => {
    const data = {}

    Object.entries(groupedData).forEach(([exerciseName, weeks]) => {
      data[exerciseName] = []

      Object.entries(weeks)
        .sort(([weekA], [weekB]) => weekA.localeCompare(weekB))
        .forEach(([week, logsInWeek]) => {
          const totalVolume = logsInWeek.reduce((sum, log) => {
            return sum + (log.weight * log.reps * 3) // 3 sets
          }, 0)

          data[exerciseName].push({
            week: week.split('-').slice(1).join('-'),
            volume: totalVolume,
            exerciseName
          })
        })
    })

    return data
  }, [groupedData])

  // Prepare graph data (combine all exercises)
  const chartData = useMemo(() => {
    if (Object.keys(volumeData).length === 0) return []

    const weeks = new Set()
    Object.values(volumeData).forEach(exerciseWeeks => {
      exerciseWeeks.forEach(item => weeks.add(item.week))
    })

    const sortedWeeks = Array.from(weeks).sort()
    const result = []

    sortedWeeks.forEach(week => {
      const dataPoint = { week }
      Object.entries(volumeData).forEach(([exerciseName, weeks]) => {
        const weekData = weeks.find(w => w.week === week)
        dataPoint[exerciseName] = weekData?.volume || 0
      })
      result.push(dataPoint)
    })

    return result
  }, [volumeData])

  // Calculate week-over-week % change
  const percentageChange = useMemo(() => {
    const changes = []

    Object.entries(volumeData).forEach(([exerciseName, weeks]) => {
      if (weeks.length >= 2) {
        const lastWeek = weeks[weeks.length - 1]
        const prevWeek = weeks[weeks.length - 2]
        const change = ((lastWeek.volume - prevWeek.volume) / prevWeek.volume * 100).toFixed(1)

        changes.push({
          exercise: exerciseName,
          lastWeek: lastWeek.volume,
          prevWeek: prevWeek.volume,
          changePercent: change
        })
      }
    })

    return changes
  }, [volumeData])

  const handleEditLog = (log) => {
    setEditingLog(log)
    setEditValues({ weight: log.weight, reps: log.reps })
  }

  const handleSaveEdit = async () => {
    if (!editingLog) return

    await db.logs.update(editingLog.id, {
      weight: editValues.weight,
      reps: editValues.reps
    })

    setEditingLog(null)
  }

  const colors = ['#00d9a3', '#00a3d9', '#d9a300', '#a300d9', '#d90000']

  return (
    <div className="comparison-page">
      <h1>Your Progress</h1>

      {/* Volume Trend Graph */}
      <div className="chart-container">
        <h2>Volume Trend (Weight × Reps × 3 Sets)</h2>
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
                <th>Last Week Volume</th>
                <th>Prev Week Volume</th>
                <th>Change %</th>
              </tr>
            </thead>
            <tbody>
              {percentageChange.map((item, idx) => (
                <tr key={idx} className={item.changePercent > 0 ? 'positive' : 'negative'}>
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

      {/* Raw Log Table */}
      <div className="table-container">
        <h2>All Logged Data</h2>
        {logs && logs.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Exercise</th>
                <th>Set</th>
                <th>Weight (kg)</th>
                <th>Reps</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {logs.sort((a, b) => new Date(b.date) - new Date(a.date)).map((log, idx) => (
                <tr key={`${log.date}-${log.exerciseName}-${log.setNum}-${idx}`}>
                  <td>{log.date}</td>
                  <td>{log.exerciseName}</td>
                  <td>{log.setNum}</td>
                  <td>{log.weight}</td>
                  <td>{log.reps}</td>
                  <td>
                    <button
                      className="edit-log-btn"
                      onClick={() => handleEditLog(log)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="no-data">No logs yet.</p>
        )}
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
                  onChange={(e) => setEditValues({ ...editValues, weight: parseFloat(e.target.value) })}
                  className="modal-input"
                />
              </label>
              <label>
                Reps:
                <input
                  type="number"
                  value={editValues.reps}
                  onChange={(e) => setEditValues({ ...editValues, reps: parseFloat(e.target.value) })}
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
