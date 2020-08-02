import {CanvasRenderingContext2D} from "canvas";

export function fillPath(
    ctx: CanvasRenderingContext2D,
    path: (ctx: CanvasRenderingContext2D) => void,
    fillRule?: CanvasFillRule,
): void {
    ctx.beginPath();
    path(ctx);
    ctx.fill(fillRule);
}

export function strokePath(
    ctx: CanvasRenderingContext2D,
    path: (ctx: CanvasRenderingContext2D) => void,
): void {
    ctx.beginPath();
    path(ctx);
    ctx.stroke();
}
