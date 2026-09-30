import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { EmptyState, PageHeader } from "@/components/ui";
import { UploadPhotoForm } from "./upload-photo-form";

export default async function NewAttendancePage({ searchParams }: PageProps<"/attendance/new">) {
  await requireUser();
  const { classroomId } = await searchParams;
  const classrooms = await db.classroom.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, _count: { select: { students: { where: { student: { active: true } } } } } },
  });

  return (
    <>
      <PageHeader
        title="Nova chamada"
        description="Tire uma foto da turma inteira. O sistema detecta os rostos e você revisa antes de confirmar."
      />
      {classrooms.length === 0 ? (
        <EmptyState>
          Nenhuma turma ativa.{" "}
          <Link href="/classes" className="text-indigo-600 hover:underline">
            Crie uma turma
          </Link>{" "}
          primeiro.
        </EmptyState>
      ) : (
        <UploadPhotoForm
          classrooms={classrooms.map((c) => ({ id: c.id, name: c.name, studentCount: c._count.students }))}
          defaultClassroomId={typeof classroomId === "string" ? classroomId : undefined}
        />
      )}
    </>
  );
}
