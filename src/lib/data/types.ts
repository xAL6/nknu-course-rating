export type Slot = { weekday: number; period: string };

/** One course offering (a course in a specific semester). */
export type Offering = {
  id?: string;
  syllabusNo: string | null;
  courseKey: string;
  teacherKey: string;
  courseCode: string;
  name: string;
  nameEn: string | null;
  credits: number | null;
  courseType: string | null;
  category: string | null;
  className: string | null;
  teachers: string[];
  classTimeRaw: string | null;
  slots: Slot[];
  classroom: string | null;
  campus: string | null;
  enrollCount: number | null;
  enrollCap: number | null;
  syllabusUrl: string | null;
  semesterId: string;
  departmentCode: string;
  departmentName: string;
  classCode: string | null;
  degreeLevel: string | null;
  dayNight: string | null;
};

export type RatingSummary = {
  reviewCount: number;
  sweetness: number | null;
  coolness: number | null;
  loading: number | null;
  quality: number | null;
  grading: number | null;
};

/** A logical course (grouped across offerings by course_key). */
export type CourseGroup = {
  courseKey: string;
  courseCode: string;
  name: string;
  nameEn: string | null;
  credits: number | null;
  departments: string[];
  teachers: string[];
  degreeLevel: string | null;
  latestSemester: string;
  offerings: Offering[];
  summary: RatingSummary | null;
};
