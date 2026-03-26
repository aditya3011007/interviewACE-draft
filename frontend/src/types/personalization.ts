export type ResumeExtractedProfile = {
    headline?: string;
    summary?: string;
    skills?: string[];
    experience_highlights?: string[];
    project_highlights?: string[];
    target_roles?: string[];
    keywords?: string[];
};

export type JobDescriptionExtractedProfile = {
    role_title?: string;
    summary?: string;
    required_skills?: string[];
    preferred_skills?: string[];
    responsibilities?: string[];
    seniority?: string;
    keywords?: string[];
};

export type ResumeProfile = {
    id: number;
    user_id: number;
    title: string;
    raw_text: string;
    extracted_profile: ResumeExtractedProfile;
    created_at: string;
};

export type JobDescriptionProfile = {
    id: number;
    user_id: number;
    title: string;
    raw_text: string;
    extracted_profile: JobDescriptionExtractedProfile;
    created_at: string;
};

export type ProfileComparison = {
    resume_id: number;
    job_description_id: number;
    role_fit_summary: string;
    match_areas: string[];
    gap_areas: string[];
    interview_risk_zones: string[];
};
