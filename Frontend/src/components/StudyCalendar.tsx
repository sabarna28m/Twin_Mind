import React, { useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import api from '../services/api';

export default function StudyCalendar() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  
  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [type, setType] = useState('Study');
  const [priority, setPriority] = useState('Medium');
  const [status, setStatus] = useState('Pending');
  const [reminder, setReminder] = useState('-1');
  
  const loadEvents = async () => {
    try {
      const userRes = await api.get('/auth/me');
      const userId = userRes.data.id;
      const res = await api.get(`/events/user/${userId}`);
      const mappedEvents = res.data.map((ev: any) => ({
        id: String(ev.id),
        title: ev.title,
        start: ev.start_time,
        end: ev.end_time,
        backgroundColor: getColorForType(ev.event_type),
        borderColor: getColorForType(ev.event_type),
        extendedProps: {
          description: ev.description,
          type: ev.event_type,
          priority: ev.priority,
          status: ev.status,
          reminder_minutes_before: ev.reminder_minutes_before,
        }
      }));
      setEvents(mappedEvents);
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const getColorForType = (t: string) => {
    switch(t) {
      case 'Study': return '#3b82f6';
      case 'Assignment': return '#8b5cf6';
      case 'Revision': return '#f59e0b';
      case 'Interview Prep': return '#10b981';
      case 'Project Work': return '#ef4444';
      default: return '#64748b';
    }
  };

  const handleDateClick = (arg: any) => {
    setEditingEvent(null);
    setTitle('');
    setDescription('');
    
    // Convert local date to datetime-local string format safely
    const localDate = arg.date;
    const startStr = new Date(localDate.getTime() - localDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    
    setStart(startStr);
    
    const endLocal = new Date(localDate.getTime() + 60*60*1000);
    const endStr = new Date(endLocal.getTime() - endLocal.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    
    setEnd(endStr);
    setType('Study');
    setPriority('Medium');
    setStatus('Pending');
    setReminder('-1');
    setModalOpen(true);
  };

  const handleEventClick = (arg: any) => {
    const ev = arg.event;
    setEditingEvent(ev);
    setTitle(ev.title);
    setDescription(ev.extendedProps.description || '');
    
    const s = ev.start;
    const e = ev.end || new Date(s.getTime() + 60*60*1000);
    
    setStart(new Date(s.getTime() - s.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    setEnd(new Date(e.getTime() - e.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    
    setType(ev.extendedProps.type);
    setPriority(ev.extendedProps.priority);
    setStatus(ev.extendedProps.status);
    setReminder(String(ev.extendedProps.reminder_minutes_before ?? -1));
    setModalOpen(true);
  };

  const handleEventDrop = async (arg: any) => {
    const ev = arg.event;
    try {
      await api.put(`/events/update/${ev.id}`, {
        start_time: ev.start.toISOString(),
        end_time: (ev.end || new Date(ev.start.getTime() + 60*60*1000)).toISOString()
      });
    } catch (err) {
      console.error('Failed to reschedule:', err);
      arg.revert();
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title,
      description,
      start_time: new Date(start).toISOString(),
      end_time: new Date(end).toISOString(),
      event_type: type,
      priority,
      status,
      reminder_minutes_before: parseInt(reminder, 10)
    };
    
    try {
      if (editingEvent) {
        await api.put(`/events/update/${editingEvent.id}`, payload);
      } else {
        await api.post('/events/create', payload);
      }
      setModalOpen(false);
      loadEvents();
    } catch (err) {
      console.error('Save failed:', err);
      alert('Failed to save event. Ensure end time is after start time.');
    }
  };

  const handleDelete = async () => {
    if (!editingEvent) return;
    if (!confirm('Are you sure you want to delete this event?')) return;
    try {
      await api.delete(`/events/delete/${editingEvent.id}`);
      setModalOpen(false);
      loadEvents();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const inp: React.CSSProperties = { padding:'0.65rem 0.9rem', border:'1px solid #e2e8f0', borderRadius:'8px', fontSize:'0.9rem', color: '#0f172a', background:'#f8f9fa', outline:'none', width:'100%', boxSizing:'border-box' as const };

  return (
    <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
      <style>{`
        .fc { font-family: inherit; }
        .fc-theme-standard td, .fc-theme-standard th { border-color: #f1f5f9; }
        .fc-col-header-cell { padding: 0.75rem 0; background: #f8fafc; color: #475569; font-weight: 600; font-size: 0.85rem; text-transform: uppercase; }
        .fc-daygrid-day-number { color: #64748b; font-weight: 500; font-size: 0.9rem; padding: 0.5rem; }
        .fc-day-today { background: rgba(59,130,246,0.03) !important; }
        .fc-event { border-radius: 4px; padding: 2px 4px; font-size: 0.8rem; font-weight: 500; border: none; cursor: pointer; transition: transform 0.1s; }
        .fc-event:hover { transform: scale(1.02); z-index: 10; }
        .fc-toolbar-title { font-size: 1.25rem !important; font-weight: 700; color: #0f172a; }
        .fc-button-primary { background: #0f172a !important; border: none !important; border-radius: 8px !important; font-weight: 600 !important; text-transform: capitalize !important; }
        .fc-button-active { background: #334155 !important; }
        .fc-today-button { background: #f1f5f9 !important; color: #0f172a !important; }
      `}</style>
      
      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Loading calendar...</div>
      ) : (
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek'
          }}
          events={events}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          editable={true}
          eventDrop={handleEventDrop}
          eventResize={handleEventDrop}
          height="700px"
        />
      )}

      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#ffffff', width: '100%', maxWidth: '480px', borderRadius: '16px', padding: '1.75rem', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
              {editingEvent ? 'Edit Event' : 'New Event'}
            </h3>
            
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input style={inp} placeholder="Event Title" value={title} onChange={e=>setTitle(e.target.value)} required />
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize:'0.75rem', fontWeight:600, color:'#64748b', marginBottom:'0.25rem', display:'block' }}>Start</label>
                  <input style={inp} type="datetime-local" value={start} onChange={e=>setStart(e.target.value)} required />
                </div>
                <div>
                  <label style={{ fontSize:'0.75rem', fontWeight:600, color:'#64748b', marginBottom:'0.25rem', display:'block' }}>End</label>
                  <input style={inp} type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)} required />
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize:'0.75rem', fontWeight:600, color:'#64748b', marginBottom:'0.25rem', display:'block' }}>Category</label>
                  <select style={inp} value={type} onChange={e=>setType(e.target.value)}>
                    <option>Study</option>
                    <option>Assignment</option>
                    <option>Revision</option>
                    <option>Interview Prep</option>
                    <option>Project Work</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:'0.75rem', fontWeight:600, color:'#64748b', marginBottom:'0.25rem', display:'block' }}>Priority</label>
                  <select style={inp} value={priority} onChange={e=>setPriority(e.target.value)}>
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                  </select>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '-0.25rem' }}>
                <div>
                  <label style={{ fontSize:'0.75rem', fontWeight:600, color:'#64748b', marginBottom:'0.25rem', display:'block' }}>Reminder</label>
                  <select style={inp} value={reminder} onChange={e => {
                    setReminder(e.target.value);
                    if (e.target.value !== '-1' && Notification.permission === 'default') {
                      Notification.requestPermission();
                    }
                  }}>
                    <option value="-1">No reminder</option>
                    <option value="0">At event time</option>
                    <option value="5">5 minutes before</option>
                    <option value="10">10 minutes before</option>
                    <option value="15">15 minutes before</option>
                    <option value="30">30 minutes before</option>
                    <option value="60">1 hour before</option>
                    <option value="1440">1 day before</option>
                  </select>
                </div>
              </div>
              
              <textarea style={{ ...inp, minHeight: '80px', resize: 'vertical' }} placeholder="Description (Optional)" value={description} onChange={e=>setDescription(e.target.value)} />
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                {editingEvent ? (
                  <button type="button" onClick={handleDelete} style={{ padding:'0.65rem 1.25rem', background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'none', borderRadius:'8px', fontWeight:600, cursor:'pointer' }}>Delete</button>
                ) : <div />}
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button type="button" onClick={() => setModalOpen(false)} style={{ padding:'0.65rem 1.25rem', background:'#f1f5f9', color:'#475569', border:'none', borderRadius:'8px', fontWeight:600, cursor:'pointer' }}>Cancel</button>
                  <button type="submit" style={{ padding:'0.65rem 1.25rem', background:'#0052cc', color:'#ffffff', border:'none', borderRadius:'8px', fontWeight:600, cursor:'pointer' }}>Save</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
