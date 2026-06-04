-- 學制 (大學部 / 碩士班 / 博士班 / 通識軍訓體育 / 學院開課 / 學程第二專長)
alter table courses add column if not exists degree_level text;
create index if not exists courses_degree_level_idx on courses (degree_level);
