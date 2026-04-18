import { Role } from "../generated/prisma/enums";

export function getBaseFrontEndURL(origin?: string){
    return "https://preview.themosaiccompany.com";
}

export function getBaseOriginDomain(origin?: string){
    if (origin?.includes("themosaiccompany")) return ".themosaiccompany.com";
    if (origin?.includes("timsstudio")) {
        return ".timsstudio.tech"
    }
    return ".timsstudio.tech"
}
export function getBaseCDNURL(origin?: string) {
    if (origin?.includes("themosaiccompany")) return "https://preview-cdn.themosaiccompany.com/";
    if (origin?.includes("timsstudio")) {
        return "https://cdn.timsstudio.tech/"
    }
    return "https://cdn.timsstudio.tech/"
}

export function getAppName(origin?: string){
    if (origin?.includes("themosaiccompany")) return "PG&E Advanced Substation";
    if (origin?.includes("timsstudio")) {
        return "TIMS Studio"
    }
    return "PG&E Advanced Substation"
}

export function getAppropriateRole(role: Role){
    if (role === "ADMIN") return "Admin"
    if (role === "VIEWER") return "Viewer"
    if(role === "MANAGER") return "Manager"
    return "Viewer"
}