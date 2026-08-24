import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { db } from '../db.js'

export default function Measurements({ measurements, onSave }) {
  const [customFields, setCustomFields] = useState(['Chest', 'Arms', 'Waist', 'Thighs'])
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    weight: '',
    customMeasurements: {}
  })
  const [editingId, setEditingId] = useState(null)
  const [newFieldName, setNewFieldName] = useState('')

  // Initialize custom measurements for form
  const initializeForm = () => {
    const obj = {}
    customFields.forEach(field => {
      obj[field] = ''
    })
    setFormData({
      date: new Date().toISOString().split('T')[0],
      weight: '',
      customMeasurements: obj
    })
  }

  const handleAddField = () => {
    if (newFieldName.trim() && !customFields.includes(newFieldName)) {
      setCustomFields([...customFields, newFieldName])
      setNewFieldName('')
    }
  }

  const handleSubmitForm = async () => {
    if (!formData.weight) {
      alert('Please enter weight')
      return
    }

    const entry = {
      date: formData.date,
      weight: parseFloat(formData.weight),
      customMeasurements: formData.customMeasurements,
      timestamp: new Date().toISOString()
    }

    if (editingId) {
      await db.measurements.update(editingId, entry)
      setEditingId(null)
    } else {
      await onSave(entry)
    }

    initializeForm()
    setShowForm(false)
  }

  const handleEditMeasurement = (measurement) => {
    setFormData({
      date: measurement.date,
      weight: measurement.weight,
      customMeasurements: measurement.customMeasurements || {}
    })
    setEditingId(measurement.id)
    setShowForm(true)
  }

  // Prepare data for charts
  const chartData = useMemo(() => {
    return measurements
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(m => ({
        date: m.date.split('-').slice(1).join('-'),
        weight: m.weight,
        ...m.customMeasurements
      }))
  }, [measurements])

  const colors = ['#00d9a3', '#00a3d9', '#d9a300', '#a300d9', '#d90000']

  return (
    <div className="measurements-page">
      <h1>Measurements</h1>

      {/* Add/Edit Form */}
      <div className="form-section">
        {!showForm ? (
          <button className="add-btn" onClick={() => { setShowForm(true); initializeForm() }}>
            + Log Measurements
          </button>
        ) : (
          <div className="measurement-form">
            <h3>{editingId ? 'Edit' : 'Log'} Measurements</h3>

            <div className="form-group">
              <label>Date:</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Weight (kg):</label>
              <input
                type="number"
                step="0.1"
                value={formData.weight}
                onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                className="form-input"
                placeholder="0.0"
              />
            </div>

            <div className="custom-fields">
              <h4>Custom Measurements</h4>
              {customFields.map(field => (
                <div key={field} className="form-group">
                  <label>{field} (cm):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.customMeasurements[field] || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      customMeasurements: {
                        ...formData.customMeasurements,
                        [field]: e.target.value ? parseFloat(e.target.value) : ''
                      }
                    })}
                    className="form-input"
                    placeholder="0.0"
                  />
                </div>
              ))}

              <div className="add-field-form">
                <input
                  type="text"
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                  placeholder="New measurement field"
                  className="form-input"
                />
                <button className="small-btn" onClick={handleAddField}>Add Field</button>
              </div>
            </div>

            <div className="form-buttons">
              <button className="save-btn" onClick={handleSubmitForm}>Save</button>
              <button className="cancel-btn" onClick={() => { setShowForm(false); setEditingId(null) }}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Weight Trend Graph */}
      {measurements.length > 0 && (
        <div className="chart-container">
          <h2>Measurement Trends</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" stroke="#888" />
              <YAxis stroke="#888" />
              <Tooltip contentStyle={{ backgroundColor: '#2a2a2a', border: '1px solid #444' }} />
              <Legend />
              <Line type="monotone" dataKey="weight" stroke="#00d9a3" strokeWidth={2} name="Weight (kg)" dot={{ r: 4 }} />
              {customFields.map((field, idx) => (
                <Line
                  key={field}
                  type="monotone"
                  dataKey={field}
                  stroke={colors[(idx + 1) % colors.length]}
                  strokeWidth={2}
                  name={field}
                  dot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Measurements Table */}
      {measurements.length > 0 && (
        <div className="table-container">
          <h2>Measurement Log</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Weight (kg)</th>
                {customFields.map(field => (
                  <th key={field}>{field} (cm)</th>
                ))}
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {measurements
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .map((m, idx) => (
                  <tr key={idx}>
                    <td>{m.date}</td>
                    <td>{m.weight}</td>
                    {customFields.map(field => (
                      <td key={field}>{m.customMeasurements?.[field] || '—'}</td>
                    ))}
                    <td>
                      <button
                        className="edit-log-btn"
                        onClick={() => handleEditMeasurement(m)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {measurements.length === 0 && !showForm && (
        <p className="no-data">No measurements logged yet. Start tracking!</p>
      )}
    </div>
  )
}
