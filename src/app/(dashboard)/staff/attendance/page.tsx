'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { KPICard } from '@/components/shared/kpi-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from '@/lib/hooks/use-toast'
import { getErrorMessage } from '@/lib/utils/errors'
import { todayIST } from '@/lib/utils/validation'
import { useUser } from '@/lib/hooks/use-user'
import { Calendar, Check, X, Clock, Sun, Users, Save, FileSpreadsheet } from 'lucide-react'

type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'leave' | 'weekly_off'

interface StaffAttendanceRow {
  id: string
  personId: string
  kind: 'driver' | 'staff'
  name: string
  type: string
  status: AttendanceStatus
  remarks: string
  /** Whether a record already exists in the DB for the selected date. */
  recorded: boolean
}

export default function AttendancePage() {
  const [selectedDate, setSelectedDate] = useState(todayIST())
  const [isSaved, setIsSaved] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const { user, can } = useUser()
  const canMark = can('MANAGE_ATTENDANCE')
  // driver_attendance is writable by operations roles only (RLS).
  const canMarkDrivers = can('MANAGE_DRIVERS')

  const [records, setRecords] = useState<StaffAttendanceRow[]>([])

  // Load drivers, staff and any attendance already recorded for the selected date
  useEffect(() => {
    let cancelled = false
    const loadStaff = async () => {
      try {
        setLoading(true)
        const supabase = createClient()
        const [driversRes, staffRes, drvAttRes, stfAttRes] = await Promise.all([
          supabase.from('drivers').select('id, full_name').eq('employment_status', 'active').order('full_name'),
          supabase.from('staff_members').select('id, full_name, staff_type').eq('employment_status', 'active').order('full_name'),
          supabase.from('driver_attendance').select('driver_id, status, remarks').eq('attendance_date', selectedDate),
          supabase.from('staff_attendance').select('staff_member_id, status, remarks').eq('attendance_date', selectedDate),
        ])
        if (driversRes.error) throw driversRes.error
        if (staffRes.error) throw staffRes.error

        const drvAtt = new Map(((drvAttRes.data as any[]) || []).map(a => [a.driver_id, a]))
        const stfAtt = new Map(((stfAttRes.data as any[]) || []).map(a => [a.staff_member_id, a]))

        const rows: StaffAttendanceRow[] = [
          ...((driversRes.data as any[]) || []).map(d => {
            const existing = drvAtt.get(d.id)
            return {
              id: `drv-${d.id}`, personId: d.id, kind: 'driver' as const, name: d.full_name, type: 'driver',
              status: (existing?.status as AttendanceStatus) || 'present', remarks: existing?.remarks || '', recorded: Boolean(existing),
            }
          }),
          ...((staffRes.data as any[]) || []).map(s => {
            const existing = stfAtt.get(s.id)
            return {
              id: `stf-${s.id}`, personId: s.id, kind: 'staff' as const, name: s.full_name, type: s.staff_type || 'labourer',
              status: (existing?.status as AttendanceStatus) || 'present', remarks: existing?.remarks || '', recorded: Boolean(existing),
            }
          }),
        ]

        if (cancelled) return
        setRecords(rows)
        // Nothing saved for this date yet -> the default "present" marks still need saving.
        setIsSaved(rows.length === 0 || rows.every(r => r.recorded))
      } catch (err) {
        console.error('Failed to load staff for attendance:', err)
        if (!cancelled) {
          setRecords([])
          toast({ title: 'Could not load attendance', description: getErrorMessage(err), variant: 'error' })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadStaff()
    return () => { cancelled = true }
  }, [selectedDate])

  const isEditable = (row: StaffAttendanceRow) => canMark && (row.kind === 'staff' || canMarkDrivers)

  const setStatus = (id: string, status: AttendanceStatus) => {
    setRecords(prev =>
      prev.map(r => (r.id === id ? { ...r, status } : r))
    )
    setIsSaved(false)
  }

  const handleSaveAttendance = async () => {
    if (!user || saving) return
    if (selectedDate > todayIST()) {
      toast({ title: 'Future date', description: 'Attendance cannot be recorded for a future date.', variant: 'error' })
      return
    }

    setSaving(true)
    try {
      const supabase = createClient()
      const staffRows = records.filter(r => r.kind === 'staff' && isEditable(r)).map(r => ({
        staff_member_id: r.personId,
        attendance_date: selectedDate,
        status: r.status,
        remarks: r.remarks.trim() || null,
        entered_by: user.id,
      }))
      const driverRows = records.filter(r => r.kind === 'driver' && isEditable(r)).map(r => ({
        driver_id: r.personId,
        attendance_date: selectedDate,
        status: r.status,
        remarks: r.remarks.trim() || null,
        entered_by: user.id,
      }))

      // Upsert against the (person, date) unique constraints so re-saving updates in place.
      const [staffRes, driverRes] = await Promise.all([
        staffRows.length
          ? (supabase.from('staff_attendance') as any).upsert(staffRows, { onConflict: 'staff_member_id,attendance_date' })
          : Promise.resolve({ error: null }),
        driverRows.length
          ? (supabase.from('driver_attendance') as any).upsert(driverRows, { onConflict: 'driver_id,attendance_date' })
          : Promise.resolve({ error: null }),
      ])
      if (staffRes.error) throw staffRes.error
      if (driverRes.error) throw driverRes.error

      setRecords(prev => prev.map(r => (isEditable(r) ? { ...r, recorded: true } : r)))
      setIsSaved(true)
      toast({
        title: 'Attendance Saved',
        description: `Muster roll for ${selectedDate} saved (${staffRows.length + driverRows.length} entries).`,
        variant: 'success',
      })
    } catch (err) {
      toast({
        title: 'Save failed',
        description: getErrorMessage(err, 'Could not save attendance'),
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  const counts = {
    present: records.filter(r => r.status === 'present').length,
    absent: records.filter(r => r.status === 'absent').length,
    halfDay: records.filter(r => r.status === 'half_day').length,
    leave: records.filter(r => r.status === 'leave').length,
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Driver & Labour Attendance Register"
        description="Fast daily muster roll for transport drivers, helpers and warehouse labour crews"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white dark:bg-gray-950 border border-gray-200 px-2.5 py-1 rounded-md">
              <Calendar className="w-4 h-4 text-orange-500" />
              <Input
                type="date"
                max={todayIST()}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-7 text-xs border-0 p-0 focus-visible:ring-0 w-32"
              />
            </div>
            <Button
              size="sm"
              disabled={isSaved || saving || !canMark || loading}
              className="bg-navy-900 hover:bg-navy-950 text-white font-semibold text-xs"
              onClick={handleSaveAttendance}
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              {saving ? 'Saving…' : isSaved ? 'Saved' : 'Save Muster'}
            </Button>
          </div>
        }
      />

      {/* Metric summary counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Present Today"
          value={counts.present}
          subtitle="Full day on duty"
          icon={Check}
          iconClassName="bg-emerald-50 text-emerald-700"
        />
        <KPICard
          title="Half Day"
          value={counts.halfDay}
          subtitle="4 hours logged"
          icon={Clock}
          iconClassName="bg-amber-50 text-amber-700"
        />
        <KPICard
          title="Absent"
          value={counts.absent}
          subtitle="Unexcused / missing"
          icon={X}
          iconClassName="bg-rose-50 text-rose-700"
        />
        <KPICard
          title="On Leave"
          value={counts.leave}
          subtitle="Approved leave"
          icon={Sun}
          iconClassName="bg-blue-50 text-blue-700"
        />
      </div>

      {/* Attendance Table */}
      <Card className="border-gray-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50 dark:bg-gray-900/60">
              <TableRow>
                <TableHead className="w-64 font-semibold text-xs">Staff Member & Role</TableHead>
                <TableHead className="font-semibold text-xs text-center">Status Marker</TableHead>
                <TableHead className="font-semibold text-xs">Notes / Trip Route</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-12 text-gray-500 text-sm">
                    Loading muster roll…
                  </TableCell>
                </TableRow>
              ) : records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-12 text-gray-500 text-sm">
                    No drivers or staff registered yet. Add drivers and staff first to mark attendance.
                  </TableCell>
                </TableRow>
              ) : (
              records.map((staff) => (
                <TableRow key={staff.id} className="hover:bg-slate-50">
                  <TableCell>
                    <div>
                      <span className="font-bold text-navy-950 text-sm block">{staff.name}</span>
                      <span className="text-[11px] font-semibold text-orange-600 uppercase">
                        {staff.type.replace(/_/g, ' ')}
                      </span>
                      {!staff.recorded && (
                        <span className="ml-2 text-[10px] font-semibold text-amber-700">• not saved</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        disabled={!isEditable(staff)}
                        onClick={() => setStatus(staff.id, 'present')}
                        className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                          staff.status === 'present'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        P (Present)
                      </button>
                      <button
                        type="button"
                        disabled={!isEditable(staff)}
                        onClick={() => setStatus(staff.id, 'half_day')}
                        className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                          staff.status === 'half_day'
                            ? 'bg-amber-500 text-white shadow-sm'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        HD (Half Day)
                      </button>
                      <button
                        type="button"
                        disabled={!isEditable(staff)}
                        onClick={() => setStatus(staff.id, 'absent')}
                        className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                          staff.status === 'absent'
                            ? 'bg-rose-600 text-white shadow-sm'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        A (Absent)
                      </button>
                      <button
                        type="button"
                        disabled={!isEditable(staff)}
                        onClick={() => setStatus(staff.id, 'leave')}
                        className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                          staff.status === 'leave'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        L (Leave)
                      </button>
                      <button
                        type="button"
                        disabled={!isEditable(staff)}
                        onClick={() => setStatus(staff.id, 'weekly_off')}
                        className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                          staff.status === 'weekly_off'
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        WO (Off)
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={staff.remarks}
                      disabled={!isEditable(staff)}
                      onChange={(e) => {
                        const val = e.target.value
                        setRecords(prev =>
                          prev.map(r => (r.id === staff.id ? { ...r, remarks: val } : r))
                        )
                        setIsSaved(false)
                      }}
                      className="h-8 text-xs bg-transparent"
                      placeholder="Add route, vehicle or delay remarks..."
                    />
                  </TableCell>
                </TableRow>
              ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}
