-- Setup application role for non-superuser RLS enforcement
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'kaziwise_app') THEN
    CREATE ROLE kaziwise_app WITH LOGIN PASSWORD 'kaziwise_secure_pass';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO kaziwise_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO kaziwise_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO kaziwise_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO kaziwise_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO kaziwise_app;

-- Helper function to get current tenant org id from session
CREATE OR REPLACE FUNCTION current_tenant_org_id() RETURNS text AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_org_id', true), '');
END;
$$ LANGUAGE plpgsql STABLE;

-- Enable RLS on Tenant-Owned Tables
ALTER TABLE "Organisation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Department" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Course" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Module" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lesson" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContentBlock" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Question" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Option" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Campaign" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CampaignSelectedUser" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Assignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LessonProgress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Attempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Certificate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS tenant_organisation_policy ON "Organisation";
DROP POLICY IF EXISTS tenant_department_policy ON "Department";
DROP POLICY IF EXISTS tenant_user_policy ON "User";
DROP POLICY IF EXISTS tenant_course_policy ON "Course";
DROP POLICY IF EXISTS tenant_module_policy ON "Module";
DROP POLICY IF EXISTS tenant_lesson_policy ON "Lesson";
DROP POLICY IF EXISTS tenant_content_block_policy ON "ContentBlock";
DROP POLICY IF EXISTS tenant_question_policy ON "Question";
DROP POLICY IF EXISTS tenant_option_policy ON "Option";
DROP POLICY IF EXISTS tenant_campaign_policy ON "Campaign";
DROP POLICY IF EXISTS tenant_campaign_selected_user_policy ON "CampaignSelectedUser";
DROP POLICY IF EXISTS tenant_assignment_policy ON "Assignment";
DROP POLICY IF EXISTS tenant_lesson_progress_policy ON "LessonProgress";
DROP POLICY IF EXISTS tenant_attempt_policy ON "Attempt";
DROP POLICY IF EXISTS tenant_certificate_policy ON "Certificate";
DROP POLICY IF EXISTS tenant_audit_log_policy ON "AuditLog";

-- Policy Definitions using current_tenant_org_id()
-- Note: if app.bypass_rls = 'on', allow access (useful for migrations/system seeds or public verification)
CREATE OR REPLACE FUNCTION rls_bypassed() RETURNS boolean AS $$
BEGIN
  RETURN current_setting('app.bypass_rls', true) = 'on';
END;
$$ LANGUAGE plpgsql STABLE;

-- Organisation
CREATE POLICY tenant_organisation_policy ON "Organisation"
  FOR ALL
  USING (rls_bypassed() OR id = current_tenant_org_id())
  WITH CHECK (rls_bypassed() OR id = current_tenant_org_id());

-- Department
CREATE POLICY tenant_department_policy ON "Department"
  FOR ALL
  USING (rls_bypassed() OR "organisationId" = current_tenant_org_id())
  WITH CHECK (rls_bypassed() OR "organisationId" = current_tenant_org_id());

-- User
CREATE POLICY tenant_user_policy ON "User"
  FOR ALL
  USING (rls_bypassed() OR "organisationId" = current_tenant_org_id())
  WITH CHECK (rls_bypassed() OR "organisationId" = current_tenant_org_id());

-- Course
CREATE POLICY tenant_course_policy ON "Course"
  FOR ALL
  USING (rls_bypassed() OR "organisationId" = current_tenant_org_id())
  WITH CHECK (rls_bypassed() OR "organisationId" = current_tenant_org_id());

-- Module
CREATE POLICY tenant_module_policy ON "Module"
  FOR ALL
  USING (rls_bypassed() OR EXISTS (
    SELECT 1 FROM "Course" c WHERE c.id = "Module"."courseId" AND c."organisationId" = current_tenant_org_id()
  ))
  WITH CHECK (rls_bypassed() OR EXISTS (
    SELECT 1 FROM "Course" c WHERE c.id = "Module"."courseId" AND c."organisationId" = current_tenant_org_id()
  ));

-- Lesson
CREATE POLICY tenant_lesson_policy ON "Lesson"
  FOR ALL
  USING (rls_bypassed() OR EXISTS (
    SELECT 1 FROM "Module" m JOIN "Course" c ON c.id = m."courseId"
    WHERE m.id = "Lesson"."moduleId" AND c."organisationId" = current_tenant_org_id()
  ))
  WITH CHECK (rls_bypassed() OR EXISTS (
    SELECT 1 FROM "Module" m JOIN "Course" c ON c.id = m."courseId"
    WHERE m.id = "Lesson"."moduleId" AND c."organisationId" = current_tenant_org_id()
  ));

-- ContentBlock
CREATE POLICY tenant_content_block_policy ON "ContentBlock"
  FOR ALL
  USING (rls_bypassed() OR EXISTS (
    SELECT 1 FROM "Lesson" l JOIN "Module" m ON m.id = l."moduleId" JOIN "Course" c ON c.id = m."courseId"
    WHERE l.id = "ContentBlock"."lessonId" AND c."organisationId" = current_tenant_org_id()
  ))
  WITH CHECK (rls_bypassed() OR EXISTS (
    SELECT 1 FROM "Lesson" l JOIN "Module" m ON m.id = l."moduleId" JOIN "Course" c ON c.id = m."courseId"
    WHERE l.id = "ContentBlock"."lessonId" AND c."organisationId" = current_tenant_org_id()
  ));

-- Question
CREATE POLICY tenant_question_policy ON "Question"
  FOR ALL
  USING (rls_bypassed() OR EXISTS (
    SELECT 1 FROM "Course" c WHERE c.id = "Question"."courseId" AND c."organisationId" = current_tenant_org_id()
  ))
  WITH CHECK (rls_bypassed() OR EXISTS (
    SELECT 1 FROM "Course" c WHERE c.id = "Question"."courseId" AND c."organisationId" = current_tenant_org_id()
  ));

-- Option
CREATE POLICY tenant_option_policy ON "Option"
  FOR ALL
  USING (rls_bypassed() OR EXISTS (
    SELECT 1 FROM "Question" q JOIN "Course" c ON c.id = q."courseId"
    WHERE q.id = "Option"."questionId" AND c."organisationId" = current_tenant_org_id()
  ))
  WITH CHECK (rls_bypassed() OR EXISTS (
    SELECT 1 FROM "Question" q JOIN "Course" c ON c.id = q."courseId"
    WHERE q.id = "Option"."questionId" AND c."organisationId" = current_tenant_org_id()
  ));

-- Campaign
CREATE POLICY tenant_campaign_policy ON "Campaign"
  FOR ALL
  USING (rls_bypassed() OR "organisationId" = current_tenant_org_id())
  WITH CHECK (rls_bypassed() OR "organisationId" = current_tenant_org_id());

-- CampaignSelectedUser
CREATE POLICY tenant_campaign_selected_user_policy ON "CampaignSelectedUser"
  FOR ALL
  USING (rls_bypassed() OR EXISTS (
    SELECT 1 FROM "Campaign" c WHERE c.id = "CampaignSelectedUser"."campaignId" AND c."organisationId" = current_tenant_org_id()
  ))
  WITH CHECK (rls_bypassed() OR EXISTS (
    SELECT 1 FROM "Campaign" c WHERE c.id = "CampaignSelectedUser"."campaignId" AND c."organisationId" = current_tenant_org_id()
  ));

-- Assignment
CREATE POLICY tenant_assignment_policy ON "Assignment"
  FOR ALL
  USING (rls_bypassed() OR EXISTS (
    SELECT 1 FROM "Campaign" c WHERE c.id = "Assignment"."campaignId" AND c."organisationId" = current_tenant_org_id()
  ))
  WITH CHECK (rls_bypassed() OR EXISTS (
    SELECT 1 FROM "Campaign" c WHERE c.id = "Assignment"."campaignId" AND c."organisationId" = current_tenant_org_id()
  ));

-- LessonProgress
CREATE POLICY tenant_lesson_progress_policy ON "LessonProgress"
  FOR ALL
  USING (rls_bypassed() OR EXISTS (
    SELECT 1 FROM "Assignment" a JOIN "Campaign" c ON c.id = a."campaignId"
    WHERE a.id = "LessonProgress"."assignmentId" AND c."organisationId" = current_tenant_org_id()
  ))
  WITH CHECK (rls_bypassed() OR EXISTS (
    SELECT 1 FROM "Assignment" a JOIN "Campaign" c ON c.id = a."campaignId"
    WHERE a.id = "LessonProgress"."assignmentId" AND c."organisationId" = current_tenant_org_id()
  ));

-- Attempt
CREATE POLICY tenant_attempt_policy ON "Attempt"
  FOR ALL
  USING (rls_bypassed() OR EXISTS (
    SELECT 1 FROM "Assignment" a JOIN "Campaign" c ON c.id = a."campaignId"
    WHERE a.id = "Attempt"."assignmentId" AND c."organisationId" = current_tenant_org_id()
  ))
  WITH CHECK (rls_bypassed() OR EXISTS (
    SELECT 1 FROM "Assignment" a JOIN "Campaign" c ON c.id = a."campaignId"
    WHERE a.id = "Attempt"."assignmentId" AND c."organisationId" = current_tenant_org_id()
  ));

-- Certificate (public verify route bypasses RLS or sets app.bypass_rls = 'on')
CREATE POLICY tenant_certificate_policy ON "Certificate"
  FOR ALL
  USING (rls_bypassed() OR EXISTS (
    SELECT 1 FROM "Assignment" a JOIN "Campaign" c ON c.id = a."campaignId"
    WHERE a.id = "Certificate"."assignmentId" AND c."organisationId" = current_tenant_org_id()
  ))
  WITH CHECK (rls_bypassed() OR EXISTS (
    SELECT 1 FROM "Assignment" a JOIN "Campaign" c ON c.id = a."campaignId"
    WHERE a.id = "Certificate"."assignmentId" AND c."organisationId" = current_tenant_org_id()
  ));

-- AuditLog
CREATE POLICY tenant_audit_log_policy ON "AuditLog"
  FOR ALL
  USING (rls_bypassed() OR EXISTS (
    SELECT 1 FROM "User" u WHERE u.id = "AuditLog"."userId" AND u."organisationId" = current_tenant_org_id()
  ))
  WITH CHECK (rls_bypassed() OR EXISTS (
    SELECT 1 FROM "User" u WHERE u.id = "AuditLog"."userId" AND u."organisationId" = current_tenant_org_id()
  ));
