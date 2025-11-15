import type { Repository } from './types'

export const REPOSITORIES: Repository[] = [
  {
    name: "E-Konsulta-Medical-Clinic/epms-api",
    description: "It's the API for the E-Konsulta Medical Clinic, where it handles the business logic for the portals.",
    stack: ["express", "typescript", "mongodb", "cloudrun", "firebase-authentication"],
  },
  {
    name: "E-Konsulta-Medical-Clinic/epms-patient-ui",
    description: "It's the patient portal for the E-Konsulta Medical Clinic, where patients can book appointments, view their consultations and their statuses, and download their medical documents.",
    stack: ["react", "typescript", "tailwindcss", "firebase-authentication", "fireabase-hosting", "pwa"],
  },
  {
    name: "E-Konsulta-Medical-Clinic/epms-admin-ui",
    description: "It's the admin portal for the E-Konsulta Medical Clinic, where admins can manage the appointments, see information about the patients and the doctors, and see the reports of the clinic.",
    stack: ["react", "typescript", "mui", "firebase-authentication", "cloudrun", "shadcn-ui"],
  },
  {
    name: "E-Konsulta-Medical-Clinic/epms-doctor-ui",
    description: "It's the doctor portal for the E-Konsulta Medical Clinic, where doctors can view their consultations, see information about the patients and the triage, they can generate the medical documents, and do the advance booking.",
    stack: ["react", "typescript", "tailwindcss", "firebase-authentication", "firebase-hosting", "shadcn-ui"],
  },
  {
    name: "E-Konsulta-Medical-Clinic/epms-web-ui",
    description: "It's the public website for the E-Konsulta Medical Clinic.",
    stack: ["astro", "typescript", "tailwindcss", "react", "shadcn-ui", "cloudflare-pages"],
  },
  {
    name: "E-Konsulta-Medical-Clinic/epms-web-workers",
    description: "It's the web workers for the E-Konsulta Medical Clinic, where it handles automated procesess.",
    stack: ["cloudflare-workers", "typescript", "cloudflare-kv", "hono"],
  },
  {
    name: "E-Konsulta-Medical-Clinic/epms-partner-ui",
    description: "It's the partner portal for the E-Konsulta Medical Clinic, where partners like pharmacies and laboratories, see information about lab requests, and prescriptions.",
    stack: ["react", "typescript", "tailwindcss", "firebase-authentication", "cloudflare-pages", "shadcn-ui", "zod", "react-hook-form", "react-router", "tank-query"],
  },
  {
    name: "E-Konsulta-Medical-Clinic/epms-tmpl-devops",
    description: "Templates for the pipelines and the workflows for the E-Konsulta Medical Clinic.",
    stack: ["yaml", "github-actions"],
  },
  {
    name: "E-Konsulta-Medical-Clinic/epms-control-center-ui",
    description: "The new control center where agents can manage the appointments, see information about the patients and the doctors, and see the reports of the clinic.",
    stack: ["react", "typescript", "tailwindcss", "firebase-authentication", "cloudflare-pages", "shadcn-ui", "zod", "react-hook-form", "react-router", "tank-query"],
  },
  {
    name: "E-Konsulta-Medical-Clinic/epms-db-snapshot-automation",
    description: "Script to create a copy backup of the database for the E-Konsulta Medical Clinic.",
    stack: ["bash", "mongodb", "nodejs"],
  },
  {
    name: "E-Konsulta-Medical-Clinic/epms-sms-api",
    description: "API to send SMS notifications to the patients for the E-Konsulta Medical Clinic.",
    stack: [],
  },
]

export const MAIN_BRANCHES = ['main', 'staging'] as const

export const API_DELAY_MS = 300
export const REPORT_TTL_SECONDS = 60 * 60 * 24 * 90 // 90 days

