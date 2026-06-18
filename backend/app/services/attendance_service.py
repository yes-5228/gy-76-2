from datetime import date, datetime, timedelta

from .validation import require_fields
from ..storage import mutate, new_id, read_data


def list_attendance():
    data = read_data()
    students = {student["id"]: student for student in data["students"]}
    teachers = {teacher["id"]: teacher for teacher in data["teachers"]}
    records = [_with_names(record, students, teachers) for record in data["attendance"]]
    records.sort(key=lambda item: item.get("created_at") or item["checked_at"], reverse=True)
    return records


def check_in(payload):
    require_fields(payload, ["student_id", "teacher_id", "course_name", "hours"])
    hours = float(payload["hours"])
    if hours <= 0:
        raise ValueError("课时必须大于 0")

    attendance_record = {
        "id": new_id("att"),
        "student_id": payload["student_id"],
        "teacher_id": payload["teacher_id"],
        "course_name": payload["course_name"].strip(),
        "hours": hours,
        "checked_at": payload.get("checked_at") or date.today().isoformat(),
        "note": payload.get("note", "").strip(),
    }

    def add_record(data):
        student = next((item for item in data["students"] if item["id"] == attendance_record["student_id"]), None)
        teacher = next((item for item in data["teachers"] if item["id"] == attendance_record["teacher_id"]), None)
        if not student:
            raise ValueError("学员不存在")
        if not teacher:
            raise ValueError("教师不存在")
        if student.get("status", "active") != "active":
            raise ValueError("学员状态异常，无法签到")
        if teacher.get("status", "active") != "active":
            raise ValueError("教师状态异常，无法签到")
        if student["remaining_hours"] < hours:
            raise ValueError("学员剩余课时不足")

        now = datetime.now()
        recent_record = next(
            (
                record
                for record in reversed(data["attendance"])
                if record["student_id"] == attendance_record["student_id"]
            ),
            None,
        )
        if recent_record:
            is_duplicate = False
            record_time_str = recent_record.get("created_at")
            if record_time_str:
                try:
                    record_time = datetime.fromisoformat(record_time_str)
                    if now - record_time < timedelta(minutes=1):
                        is_duplicate = True
                except (ValueError, TypeError):
                    pass
            if not is_duplicate and recent_record.get("checked_at") == attendance_record["checked_at"]:
                is_duplicate = True
            if is_duplicate:
                raise ValueError("该学员刚刚已签到，请勿重复操作")

        student["remaining_hours"] = round(student["remaining_hours"] - hours, 2)
        attendance_record["created_at"] = now.isoformat()
        data["attendance"].append(attendance_record)
        return data

    mutate(add_record)
    return attendance_record


def _with_names(record, students, teachers):
    student = students.get(record["student_id"], {})
    teacher = teachers.get(record["teacher_id"], {})
    display_time = record.get("checked_at", "")
    has_exact_time = False
    created_at_str = record.get("created_at")
    if created_at_str:
        try:
            created_at = datetime.fromisoformat(created_at_str)
            display_time = created_at.strftime("%Y-%m-%d %H:%M")
            has_exact_time = True
        except (ValueError, TypeError):
            pass
    return {
        **record,
        "student_name": student.get("name", "未知学员"),
        "teacher_name": teacher.get("name", "未知教师"),
        "display_time": display_time,
        "has_exact_time": has_exact_time,
    }
