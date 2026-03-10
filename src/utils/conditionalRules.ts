export function getBaseFrontEndURL(origin?: string){
    if (origin?.includes("themosaiccompany"))  return "https://preview.themosaiccompany.com";
    if(origin?.includes("timsstudio")){
        return "https://timsstudio.tech"
    }
    return "http://localhost:3000"
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
    if (origin?.includes("themosaiccompany")) return "Mosaic WebGL Viewer";
    if (origin?.includes("timsstudio")) {
        return "TIMS Studio"
    }
    return "Mosaic WebGL Viewer"
}