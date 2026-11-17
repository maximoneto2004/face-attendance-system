import Link from "next/link";
import { cookies } from "next/headers";
import { LAST_CLASSROOM_COOKIE } from "@/lib/preferences";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { classroomScope } from "@/lib/access";
import { EmptyState, PageHeader, buttonClass } from "@/components/ui";
import { Icon } from "@/components/icons";
import { UploadPhotoForm } from "./upload-photo-form";

export default async function NewAttendancePage({ searchParams }: PageProps<"/attendance/new">) {
  const user = await requireUser();
  const { classroomId } = await searchParams;
  const lastClassroomId = (await cookies()).get(LAST_CLASSROOM_COOKIE)?.value;
  const classrooms = await db.classroom.findMany({
    where: { active: true, ...classroomScope(user) },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      _count: { select: { students: { where: { student: { active: true } } } } },
      students: {
        where: { student: { active: true, faceIdentities: { some: {} } } },
        select: { studentId: true },
      },
    },
  });

  return (
    <>
      <PageHeader
        title="Nova chamada"
        description="Tire uma foto da turma. O sistema encontra os rostos e você confere antes de confirmar."
      />
      {classrooms.length === 0 ? (
        <EmptyState
          icon="layers"
          title="Nenhuma turma ativa"
          action={
            <Link href="/classes" className={buttonClass("primary")}>
              <Icon name="plus" className="h-4 w-4" />
              Criar turma
            </Link>
          }
        >
          Para fazer uma chamada, crie uma turma e adicione os alunos primeiro.
        </EmptyState>
      ) : (
        <UploadPhotoForm
          classrooms={classrooms.map((c) => ({
            id: c.id,
            name: c.name,
            studentCount: c._count.students,
            withFaceCount: c.students.length,
          }))}
          defaultClassroomId={typeof classroomId === "string" ? classroomId : lastClassroomId}
        />
      )}
    </>
  );
}
