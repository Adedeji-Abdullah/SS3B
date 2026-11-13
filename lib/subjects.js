export const SUBJECTS = [
  "English",
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "Further Mathematics",
  "Geography",
  "Economics",
  "Animal Husbandry",
  "Agricultural Science",
  "CCA (Creative and Cultural Arts)",
  "Computer and Digital Technology",
];

export const RATING_VALUES = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

export function normalizeStudentName(value) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}
