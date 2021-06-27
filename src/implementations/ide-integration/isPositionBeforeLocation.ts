import { Location } from "../../generic";

export function isPositionBeforeLocation(
    positionLine: number,
    positionCharacter: number,
    location: Location
): boolean {
    return positionLine < location.line
        || (
            positionLine === location.line
            && positionCharacter < location.column
        )
}