export type DocumentType = "CC" | "TI" | "CE" | "PASAPORTE";

export type StudentGroup =
  | "KUNGFU_NINOS"
  | "KUNGFU_ADULTOS_PRINCIPIANTES"
  | "KUNGFU_ADULTOS_AVANZADOS"
  | "SANDA"
  | "TAICHI";

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  documentType: DocumentType;
  documentNumber: string;
  birthDate?: Date | string | null;
  nationality: string;
  phone?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  isMinor: boolean;
  guardianName?: string | null;
  guardianPhone?: string | null;
  guardianRelationship?: string | null;
  isActive: boolean;
  isScholarship: boolean;
  groups: StudentGroup[];
  beltGrade?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface StudentCreateInput {
  firstName: string;
  lastName: string;
  documentType: DocumentType;
  documentNumber: string;
  birthDate?: string;
  nationality?: string;
  phone?: string | null;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  isMinor: boolean;
  guardianName?: string;
  guardianPhone?: string;
  guardianRelationship?: string;
  isActive?: boolean;
  isScholarship?: boolean;
  groups?: StudentGroup[];
  beltGrade?: string | null;
}

export interface StudentUpdateInput extends Partial<StudentCreateInput> {}
