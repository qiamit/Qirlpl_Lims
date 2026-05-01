import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Construction } from 'lucide-react'
import GlobalLayout from '@/components/layout/GlobalLayout'
import DashboardPage from '@/features/dashboard/DashboardPage'
import { SamplesPage } from '@/features/samples'
import SampleReceivingMasterPage from '@/features/sample-handling/receiving/SampleReceivingMasterPage'
import SampleStageMasterPage from '@/features/sample-handling/SampleStageMasterPage'
import SampleAllocationMasterPage from '@/features/sample-handling/allocation/SampleAllocationMasterPage'
import TestAllocationMasterPage from '@/features/sample-handling/test-allocation/TestAllocationMasterPage'
import SampleUnderTestingMasterPage from '@/features/sample-handling/sample-under-testing/SampleUnderTestingMasterPage'
import ResultsUnderReviewMasterPage from '@/features/sample-handling/results-under-review/ResultsUnderReviewMasterPage'
import TestReportPreparationMasterPage from '@/features/sample-handling/report-preparation/TestReportPreparationMasterPage'
import { TestingPage } from '@/features/testing'
import { ReportingPage } from '@/features/reporting'
import { PersonnelPage } from '@/features/personnel'
import { DocumentsPage } from '@/features/documents'
import { AuditsPage } from '@/features/audits'
import LabSettingsPage from '@/features/settings/LabSettingsPage'
import UserManagementPage from '@/features/settings/UserManagementPage'
import AuthPage from '@/features/auth/AuthPage'
import ClientsPage from '@/features/masters/ClientsPage'
import IsCodesPage from '@/features/masters/IsCodesPage'
import ProductServicesPage from '@/features/masters/ProductServicesPage'
import EquipmentMasterPage from '@/features/masters/EquipmentMasterPage'
import CalibrationMasterPage from '@/features/masters/CalibrationMasterPage'
import IntermediateChecksMasterPage from '@/features/masters/intermediate-checks/IntermediateChecksMasterPage'
import MaintenanceMasterMasterPage from '@/features/masters/maintenance-master/MaintenanceMasterMasterPage'
import TestParameterPage from '@/features/masters/TestParameterPage'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { RequireLaboratoryDirector } from '@/components/auth/RequireLaboratoryDirector'
import { RequireSampleReceivingAccess } from '@/components/auth/RequireSampleReceivingAccess'
import { RequireSampleAllocationAccess } from '@/components/auth/RequireSampleAllocationAccess'
import { RequireTestAllocationAccess } from '@/components/auth/RequireTestAllocationAccess'

function PlaceholderPage({ title, clause }: { title: string; clause: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4 text-center max-w-md">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Construction size={28} className="text-primary" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">
            ISO 17025:2017 — {clause}
          </p>
        </div>
        <p className="text-sm text-muted-foreground/70">
          This module is under development and will be available in an upcoming release.
        </p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="auth" element={<AuthPage />} />

        <Route
          element={
            <RequireAuth>
              <GlobalLayout />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />

          {/* Clause 6 – Resource Requirements */}
          <Route path="personnel" element={<PersonnelPage />} />
          <Route path="facilities" element={<PlaceholderPage title="Facilities & Environment" clause="Clause 6.3" />} />
          <Route path="equipment" element={<EquipmentMasterPage />} />
          <Route
            path="equipment/calibration-master"
            element={<CalibrationMasterPage />}
          />
          <Route
            path="equipment/intermediate-checks"
            element={<IntermediateChecksMasterPage />}
          />
          <Route
            path="equipment/maintenance-master"
            element={<MaintenanceMasterMasterPage />}
          />
          <Route path="traceability" element={<PlaceholderPage title="Metrological Traceability" clause="Clause 6.5" />} />
          <Route path="suppliers" element={<PlaceholderPage title="External Services & Suppliers" clause="Clause 6.6" />} />

          {/* Clause 7 – Process Requirements */}
          <Route path="contracts" element={<PlaceholderPage title="Contracts & Requests" clause="Clause 7.1" />} />
          <Route path="methods" element={<PlaceholderPage title="Methods & Validation" clause="Clause 7.2" />} />
          <Route path="sampling" element={<PlaceholderPage title="Sampling" clause="Clause 7.3" />} />
          <Route path="samples" element={<SamplesPage />} />
          <Route path="samples/receiving" element={<RequireSampleReceivingAccess><SampleReceivingMasterPage /></RequireSampleReceivingAccess>} />
          <Route path="samples/allocation" element={<RequireSampleAllocationAccess><SampleAllocationMasterPage /></RequireSampleAllocationAccess>} />
          <Route path="samples/test-allocation" element={<RequireTestAllocationAccess><TestAllocationMasterPage /></RequireTestAllocationAccess>} />
          <Route path="samples/under-testing" element={<SampleUnderTestingMasterPage />} />
          <Route path="samples/results-review" element={<ResultsUnderReviewMasterPage />} />
          <Route path="samples/report-preparation" element={<TestReportPreparationMasterPage />} />
          <Route path="samples/completed" element={<SampleStageMasterPage stage="completed" title="Completed Results" />} />
          <Route path="testing" element={<TestingPage />} />
          <Route path="uncertainty" element={<PlaceholderPage title="Measurement Uncertainty" clause="Clause 7.6" />} />
          <Route path="validity" element={<PlaceholderPage title="Ensuring Validity of Results" clause="Clause 7.7" />} />
          <Route path="reports" element={<ReportingPage />} />
          <Route path="complaints" element={<PlaceholderPage title="Complaints" clause="Clause 7.9" />} />
          <Route path="ncw" element={<PlaceholderPage title="Nonconforming Work" clause="Clause 7.10" />} />
          <Route path="data-control" element={<PlaceholderPage title="Data & IT Control" clause="Clause 7.11" />} />

          {/* Clause 8 – Management System */}
          <Route path="ms-docs" element={<PlaceholderPage title="MS Documentation" clause="Clause 8.2" />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="records" element={<PlaceholderPage title="Control of Records" clause="Clause 8.4" />} />
          <Route path="risks" element={<PlaceholderPage title="Risks & Opportunities" clause="Clause 8.5" />} />
          <Route path="improvement" element={<PlaceholderPage title="Improvement" clause="Clause 8.6" />} />
          <Route path="corrective-actions" element={<PlaceholderPage title="Corrective Actions" clause="Clause 8.7" />} />
          <Route path="audits" element={<AuditsPage />} />
          <Route path="management-review" element={<PlaceholderPage title="Management Review" clause="Clause 8.9" />} />

          {/* Finance Management */}
          <Route path="finance" element={<PlaceholderPage title="Finance Overview" clause="Finance" />} />
          <Route path="finance/invoices" element={<PlaceholderPage title="Invoices" clause="Finance" />} />
          <Route path="finance/receipts" element={<PlaceholderPage title="Receipts" clause="Finance" />} />

          {/* Masters Management */}
          <Route path="masters/clients" element={<ClientsPage />} />
          <Route path="masters/is-codes" element={<IsCodesPage />} />
          <Route path="masters/product-services" element={<ProductServicesPage />} />
          <Route path="masters/test-parameter" element={<TestParameterPage />} />
          <Route path="masters/equipment-types" element={<EquipmentMasterPage />} />

          {/* Top Bar Pages */}
          <Route
            path="lab-settings"
            element={
              <RequireLaboratoryDirector>
                <LabSettingsPage />
              </RequireLaboratoryDirector>
            }
          />
          <Route
            path="lab-settings/user-management"
            element={
              <RequireLaboratoryDirector>
                <UserManagementPage />
              </RequireLaboratoryDirector>
            }
          />
          <Route path="help" element={<PlaceholderPage title="Help" clause="Help" />} />
          <Route path="contact-us" element={<PlaceholderPage title="Contact Us" clause="Support" />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
