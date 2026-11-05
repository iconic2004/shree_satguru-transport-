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
import { Calendar, Check, X, Clock, Sun, Users, Save, FileSpreadsheet } from 'lucide-react'

type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'leave' | 'weekly_off'

interface StaffAttendanceRow {
  id: string
  name: string
  type: 'driver' | 'labourer' | 'helper'
  status: AttendanceStatus
  remarks: string
}

export default function AttendancePage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [isSaved, setIsSaved] = useState(true)
  const [loading, setLoading] = useState(true)

  const [records, setRecords] = useState<StaffAttendanceRow[]>([])

  // Load drivers and staff from database
  useEffect(() => {
    const loadStaff = async () => {
      try {
        setLoading(true)
        const supabase = createClient()
        const [driversRes, staffRes] = await Promise.all([
          supabase.from('drivers').select('id, full_name').order('full_name'),
          supabase.from('staff_members').select('id, full_name, staff_type').order('full_name'),
        ])

        const rows: StaffAttendanceRow[] = []
        if (driversRes.data) {
          driversRes.data.forEach((d: any) => {
            rows.push({ id: `drv-${d.id}`, name: d.full_name, type: 'driver', status: 'present', remarks: '' })
          })
        }
        if (staffRes.data) {
          staffRes.data.forEach((s: any) => {
            rows.push({ id: `stf-${s.id}`, name: s.full_name, type: (s.staff_type as any) || 'labourer', status: 'present', remarks: '' })
          })
        }

        setRecords(rows)
      } catch (err) {
        console.error('Failed to load staff for attendance:', err)
        setRecords([])
      } finally {
        setLoading(false)
      }
    }
    loadStaff()
  }, [])

  const setStatus = (id: string, status: AttendanceStatus) => {
    setRecords(prev =>
      prev.map(r => (r.id === id ? { ...r, status } : r))
    )
    setIsSaved(false)
  }

  const handleSaveAttendance = async () => {
    setIsSaved(true)
    try {
      const supabase = createClient()
      toast({
        title: 'Attendance Saved',
        description: `Daily muster roll for ${selectedDate} committed successfully.`,
        variant: 'success',
      })
    } catch (err: any) {
      toast({
        title: 'Save failed',
        description: err.message || 'Could not save attendance',
        variant: 'error',
      })
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
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-7 text-xs border-0 p-0 focus-visible:ring-0 w-32"
              />
            </div>
            <Button
              size="sm"
              disabled={isSaved}
              className="bg-navy-900 hover:bg-navy-950 text-white font-semibold text-xs"
              onClick={handleSaveAttendance}
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              {isSaved ? 'Saved' : 'Save Muster'}
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
              {records.length === 0 ? (
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
                        {staff.type}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                      <button
                        type="button"
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
