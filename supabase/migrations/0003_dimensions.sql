-- Properly model the course dimensions: 學制 / 系所·班級 / 上課地點(校區).

-- 學制 code (1 大學部 / 2 碩 / 3 博 / G 通識軍訓體育 / S 學院 / H 學程第二專長)
alter table courses add column if not exists degree_level_code text;
-- 班級 (系級) code, e.g. CH02101 = 國文系一年級甲班  (class_name already exists)
alter table courses add column if not exists class_code text;

create index if not exists courses_degree_level_code_idx on courses (degree_level_code);
create index if not exists courses_class_code_idx on courses (class_code);
create index if not exists courses_campus_idx on courses (campus);
create index if not exists courses_day_night_idx on courses (day_night);

-- 上課地點 reference: every room with its 校區 + 大樓 (from scheduleRoom.aspx).
create table if not exists rooms (
  room_code text primary key,     -- e.g. '3312'
  campus    text not null,        -- 和平 / 燕巢
  building  text,                 -- 03 文學大樓
  name      text                  -- 國文系教室
);
