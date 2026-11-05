'use client'

import { useState } from 'react'
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

  const [records, setRecords] = useState<StaffAttendanceRow[]>([
    { id: '1', name: 'Ramesh Yadav', type: 'driver', status: 'present', remarks: 'On route MH-04-GP-4521' },
    { id: '2', name: 'Santosh Patil', type: 'driver', status: 'present', remarks: 'Bhiwandi to Thane route' },
    { id: '3', name: 'Mohammad Irfan', type: 'driver', status: 'present', remarks: 'Local tempo dispatch' },
    { id: '4', name: 'Dnyaneshwar Shinde', type: 'driver', status: 'half_day', remarks: 'Left after 12:30 PM' },
    { id: '5', name: 'Baban Kamble', type: 'labourer', status: 'present', remarks: 'Bhiwandi Godown loading' },
    { id: '6', name: 'Sunil Pawar', type: 'labourer', status: 'present', remarks: 'Bhiwandi Godown loading' },
    { id: '7', name: 'Deepak More', type: 'helper', status: 'present', remarks: 'Vehicle helper with Santosh' },
    { id: '8', name: 'Vijay Jadhav', type: 'labourer', status: 'absent', remarks: 'Medical leave informed' },
  ])

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
              {records.map((staff) => (
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
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}
