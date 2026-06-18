import { useMemo, useState } from "react";
import { api } from "../api/client";
import { EmptyState } from "../components/EmptyState";

const initialForm = {
  student_id: "",
  teacher_id: "",
  course_name: "",
  hours: 1,
  checked_at: new Date().toISOString().slice(0, 10),
  note: "",
};

export function AttendancePage({ students, teachers, attendance, onCreated, onRefresh }) {
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedStudent = useMemo(
    () => students.find((item) => item.id === form.student_id),
    [students, form.student_id]
  );
  const selectedTeacher = useMemo(
    () => teachers.find((item) => item.id === form.teacher_id),
    [teachers, form.teacher_id]
  );

  const studentInactive = selectedStudent && selectedStudent.status !== "active";
  const teacherInactive = selectedTeacher && selectedTeacher.status !== "active";
  const hoursInsufficient = selectedStudent && form.hours > selectedStudent.remaining_hours;
  const hoursInvalid = form.hours <= 0;
  const canSubmit =
    !submitting &&
    form.student_id &&
    form.teacher_id &&
    form.course_name &&
    form.hours > 0 &&
    !studentInactive &&
    !teacherInactive &&
    !hoursInsufficient;

  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setMessage("");
    setMessageType("");
    try {
      await api.checkIn(form);
      setForm(initialForm);
      await onCreated();
      setMessage("签到成功，课时已扣减");
      setMessageType("success");
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
      if (onRefresh) {
        await onRefresh();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onStudentChange = (studentId) => {
    const student = students.find((item) => item.id === studentId);
    setForm((current) => ({
      ...current,
      student_id: studentId,
      course_name: student?.course || current.course_name,
    }));
  };

  return (
    <div className="two-column">
      <section className="panel">
        <div className="panel-heading">
          <h2>签到打卡</h2>
          <span>自动扣减课时</span>
        </div>
        <form className="form-stack" onSubmit={submit}>
          <label>
            学员
            <select value={form.student_id} onChange={(event) => onStudentChange(event.target.value)} required>
              <option value="">请选择学员</option>
              {students.map((student) => (
                <option key={student.id} value={student.id} disabled={student.status !== "active"}>
                  {student.name}（余 {student.remaining_hours}）{student.status !== "active" ? " — 已停用" : ""}
                </option>
              ))}
            </select>
          </label>
          {studentInactive ? (
            <div className="inline-message error">该学员已停用，无法签到</div>
          ) : null}

          <label>
            授课教师
            <select value={form.teacher_id} onChange={(event) => setForm({ ...form, teacher_id: event.target.value })} required>
              <option value="">请选择教师</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id} disabled={teacher.status !== "active"}>
                  {teacher.name} / {teacher.subject}{teacher.status !== "active" ? " — 已停用" : ""}
                </option>
              ))}
            </select>
          </label>
          {teacherInactive ? (
            <div className="inline-message error">该教师已停用，无法签到</div>
          ) : null}

          <div className="form-row">
            <label>
              课程
              <input value={form.course_name} onChange={(event) => setForm({ ...form, course_name: event.target.value })} required />
            </label>
            <label>
              课时
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={form.hours}
                onChange={(event) => setForm({ ...form, hours: Number(event.target.value) })}
                required
              />
            </label>
          </div>
          {hoursInvalid ? (
            <div className="inline-message error">课时必须大于 0</div>
          ) : hoursInsufficient ? (
            <div className="inline-message error">剩余课时不足（剩余 {selectedStudent.remaining_hours} 课时）</div>
          ) : null}

          <label>
            日期
            <input type="date" value={form.checked_at} onChange={(event) => setForm({ ...form, checked_at: event.target.value })} />
          </label>
          <label>
            备注
            <textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} rows="3" />
          </label>
          <button className="primary-button" type="submit" disabled={!canSubmit}>
            {submitting ? "签到中..." : "确认签到"}
          </button>
          {message ? <div className={`inline-message ${messageType}`}>{message}</div> : null}
        </form>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>签到记录</h2>
          <span>{attendance.length} 条</span>
        </div>
        {attendance.length ? (
          attendance.map((record) => (
            <div className="table-row" key={record.id}>
              <div>
                <strong>{record.student_name}</strong>
                <span>{record.checked_at} / {record.teacher_name} / {record.course_name}</span>
              </div>
              <b>{record.hours} 课时</b>
            </div>
          ))
        ) : (
          <EmptyState text="暂无签到记录" />
        )}
      </section>
    </div>
  );
}
