import { jsxDEV } from "react/jsx-dev-runtime";
import React, { useState, useMemo, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Player } from "@websim/remotion/player";
import { BingoCardClip } from "./composition.jsx";
import BingoCage from "./BingoCage.jsx";
import { v4 as uuidv4 } from "uuid";
const exampleCard = [
  ["1", "18", "31", "48", "63"],
  ["2", "16", "30", "52", "66"],
  ["5", "20", "FREE", "57", "72"],
  ["12", "21", "39", "51", "68"],
  ["7", "24", "34", "46", "70"]
];
function HeaderSmall() {
  const letters = ["B", "I", "N", "G", "O"];
  return /* @__PURE__ */ jsxDEV(
    "div",
    {
      style: {
        display: "flex",
        gap: 8,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 12
      },
      children: letters.map((L) => /* @__PURE__ */ jsxDEV(
        "div",
        {
          style: {
            width: 150,
            height: 150,
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#ffffff",
            boxShadow: "0 4px 10px rgba(0,0,0,0.06)",
            border: "3px solid #2b2b2b",
            fontSize: 84,
            fontWeight: 800,
            color: "#1b1b1b",
            fontFamily: "Arial, Helvetica, sans-serif"
          },
          children: L
        },
        L,
        false,
        {
          fileName: "<stdin>",
          lineNumber: 30,
          columnNumber: 9
        },
        this
      ))
    },
    void 0,
    false,
    {
      fileName: "<stdin>",
      lineNumber: 20,
      columnNumber: 5
    },
    this
  );
}
function InteractiveApp() {
  const [actions, setActions] = useState([]);
  const [playerKey, setPlayerKey] = useState(0);
  const [isReplayMode, setIsReplayMode] = useState(false);
  const [gameSeed] = useState(() => Math.floor(Math.random() * 1e6));
  const [sessionStartTime] = useState(Date.now());
  const physicsRecording = useRef({});
  const getSafeFrame = (frame) => {
    if (typeof frame === "number" && Number.isFinite(frame)) {
      return Math.floor(frame);
    }
    const fb = Math.round((Date.now() - sessionStartTime) / 1e3 * 30);
    return Number.isFinite(fb) ? fb : 0;
  };
  const handleFrameUpdate = (frame, data) => {
    physicsRecording.current[frame] = data;
  };
  const calledNumbers = useMemo(
    () => actions.filter((a) => a.type === "draw").map((a) => a.number),
    [actions]
  );
  const handleCellTap = (r, c) => {
    const cell = exampleCard[r][c];
    const isFree = typeof cell === "string" && cell.toLowerCase().includes("free");
    let isCalled = false;
    if (!isFree) {
      const num = Number(cell);
      if (Number.isFinite(num)) {
        isCalled = calledNumbers.includes(num);
      }
    }
    if (!isFree && !isCalled) {
      return;
    }
    const frame = getSafeFrame(null);
    const next = [...actions, { type: "tap", r, c, frame }];
    setActions(next);
  };
  const handleSpinStart = (frame) => {
    const f = getSafeFrame(frame);
    const next = [...actions, { type: "spin", frame: f }];
    setActions(next);
  };
  const handleBallDraw = async (number, frame) => {
    const f = getSafeFrame(frame);
    const id = uuidv4();
    setActions((prev) => [...prev, { type: "draw", number, frame: f, id, audioUrl: null }]);
    try {
      const letterIndex = Math.floor((number - 1) / 15);
      const letters = ["B", "I", "N", "G", "O"];
      const letter = letters[Math.max(0, Math.min(letters.length - 1, letterIndex))];
      const text = `${letter} ${number}`;
      if (window.websim && window.websim.textToSpeech) {
        const result = await window.websim.textToSpeech({
          text,
          voice: "en-male"
        });
        const url = result?.url;
        if (url) {
          setActions(
            (prev) => prev.map((a) => a.id === id ? { ...a, audioUrl: url } : a)
          );
          try {
            const audio = new Audio(url);
            audio.play().catch((err) => {
              console.warn("Live TTS playback blocked or failed", err);
            });
          } catch (err) {
            console.warn("Unable to create audio element for TTS", err);
          }
        }
      }
    } catch (e) {
      console.error("TTS generation failed", e);
    }
  };
  const clearActions = () => {
    setActions([]);
    physicsRecording.current = {};
    setIsReplayMode(false);
    setPlayerKey((k) => k + 1);
  };
  const matchForPlayer = useMemo(() => {
    if (!isReplayMode) return { card: exampleCard, highlights: [], durationInFrames: 150, seed: gameSeed };
    if (actions.length === 0) return { card: exampleCard, highlights: [], durationInFrames: 150, seed: gameSeed };
    const safeFrame = (f) => Number.isFinite(f) ? f : 0;
    const tapActions = actions.filter((a) => a.type === "tap").map((a) => ({
      r: a.r + 1,
      c: a.c,
      frame: safeFrame(a.frame)
    }));
    const spinDurationFrames = 60;
    const spinWindows = actions.filter((a) => a.type === "spin").map((a) => {
      const start = safeFrame(a.frame);
      return {
        startFrame: start,
        endFrame: start + spinDurationFrames
      };
    });
    const drawWithFrame = actions.filter((a) => a.type === "draw").map((a) => ({
      frame: safeFrame(a.frame),
      number: a.number,
      audioUrl: a.audioUrl || null
    }));
    const maxTapFrame = tapActions.reduce((m, a) => Math.max(m, a.frame), 0);
    const maxSpinFrame = spinWindows.reduce((m, w) => Math.max(m, w.endFrame), 0);
    const maxDrawFrame = drawWithFrame.reduce((m, d) => Math.max(m, d.frame), 0);
    const maxFrame = Math.max(maxTapFrame, maxSpinFrame, maxDrawFrame);
    const durationInFrames = Math.max(150, maxFrame + 60);
    const lettersRow2 = ["B", "I", "N", "G", "O"];
    const cardWithHeader = [lettersRow2, ...exampleCard];
    return {
      card: cardWithHeader,
      replayActions: tapActions,
      replaySpinWindows: spinWindows,
      replayDraws: drawWithFrame,
      durationInFrames,
      seed: gameSeed,
      replayData: physicsRecording.current
      // Pass the full physics recording
    };
  }, [isReplayMode, actions, gameSeed]);
  const lettersRow = ["B", "I", "N", "G", "O"];
  const gridRows = [lettersRow, ...exampleCard];
  return /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", height: "100%", gap: 12, alignItems: "center", padding: 12, boxSizing: "border-box", justifyContent: "center" }, children: [
    /* @__PURE__ */ jsxDEV("div", { style: { width: 360, boxSizing: "border-box", background: "#fff", borderRadius: 12, padding: 12 }, children: /* @__PURE__ */ jsxDEV("div", { style: {
      width: "100%",
      height: 640,
      marginTop: 8,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#fafafa",
      borderRadius: 12,
      boxShadow: "0 8px 20px rgba(0,0,0,0.06)",
      overflow: "hidden"
    }, children: /* @__PURE__ */ jsxDEV("div", { style: {
      width: 1020,
      padding: 20,
      borderRadius: 20,
      background: "#fff",
      transform: "scale(0.33)",
      transformOrigin: "center center",
      boxSizing: "content-box",
      display: "flex",
      flexDirection: "column",
      alignItems: "center"
    }, children: [
      /* @__PURE__ */ jsxDEV(
        "div",
        {
          style: {
            width: "100%",
            height: 650,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            marginBottom: 24,
            marginTop: -20
          },
          children: /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", flexDirection: "row", alignItems: "center", gap: 24 }, children: [
            /* @__PURE__ */ jsxDEV(
              BingoCage,
              {
                width: 700,
                height: 650,
                onSpinStart: handleSpinStart,
                onBallDraw: handleBallDraw,
                onFrameUpdate: handleFrameUpdate,
                seed: gameSeed
              },
              void 0,
              false,
              {
                fileName: "<stdin>",
                lineNumber: 271,
                columnNumber: 17
              },
              this
            ),
            /* @__PURE__ */ jsxDEV(
              "div",
              {
                style: {
                  width: 240,
                  height: 550,
                  padding: 20,
                  borderRadius: 20,
                  border: "4px solid #ddd",
                  background: "#fafafa",
                  boxSizing: "border-box",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  overflow: "hidden"
                },
                children: [
                  /* @__PURE__ */ jsxDEV(
                    "div",
                    {
                      style: {
                        fontSize: 32,
                        fontWeight: 800,
                        marginBottom: 16,
                        fontFamily: "Arial, Helvetica, sans-serif",
                        color: "#333",
                        borderBottom: "2px solid #ddd",
                        paddingBottom: 8,
                        width: "100%",
                        textAlign: "center"
                      },
                      children: "Drawn"
                    },
                    void 0,
                    false,
                    {
                      fileName: "<stdin>",
                      lineNumber: 295,
                      columnNumber: 19
                    },
                    this
                  ),
                  /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", alignContent: "flex-start" }, children: [
                    actions.filter((a) => a.type === "draw").length === 0 && /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 24, color: "#777", marginTop: 20 }, children: "Ready" }, void 0, false, {
                      fileName: "<stdin>",
                      lineNumber: 312,
                      columnNumber: 23
                    }, this),
                    actions.filter((a) => a.type === "draw").map((d, idx) => {
                      const letters = ["B", "I", "N", "G", "O"];
                      const lIdx = Math.floor((d.number - 1) / 15);
                      const letter = letters[lIdx] || "";
                      return /* @__PURE__ */ jsxDEV(
                        "div",
                        {
                          style: {
                            width: 80,
                            height: 80,
                            borderRadius: 40,
                            border: "5px solid #2b2b2b",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "#fff",
                            boxShadow: "0 2px 6px rgba(0,0,0,0.1)"
                          },
                          children: [
                            /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 32, fontWeight: 800, color: "#555", lineHeight: 1, marginTop: 4 }, children: letter }, void 0, false, {
                              fileName: "<stdin>",
                              lineNumber: 336,
                              columnNumber: 27
                            }, this),
                            /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 34, fontWeight: 900, lineHeight: 1, marginTop: -2 }, children: d.number }, void 0, false, {
                              fileName: "<stdin>",
                              lineNumber: 337,
                              columnNumber: 27
                            }, this)
                          ]
                        },
                        `${d.number}-${idx}`,
                        true,
                        {
                          fileName: "<stdin>",
                          lineNumber: 321,
                          columnNumber: 25
                        },
                        this
                      );
                    })
                  ] }, void 0, true, {
                    fileName: "<stdin>",
                    lineNumber: 310,
                    columnNumber: 19
                  }, this)
                ]
              },
              void 0,
              true,
              {
                fileName: "<stdin>",
                lineNumber: 280,
                columnNumber: 17
              },
              this
            )
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 270,
            columnNumber: 15
          }, this)
        },
        void 0,
        false,
        {
          fileName: "<stdin>",
          lineNumber: 259,
          columnNumber: 13
        },
        this
      ),
      /* @__PURE__ */ jsxDEV("div", { style: { display: "grid", gridTemplateColumns: "repeat(5, 150px)", gap: 8, justifyContent: "center", marginTop: 0 }, children: gridRows.map(
        (row, rIdx) => row.map((cell, cIdx) => {
          const isHeader = rIdx === 0;
          if (isHeader) {
            return /* @__PURE__ */ jsxDEV(
              "div",
              {
                style: {
                  width: 150,
                  height: 150,
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#ffffff",
                  boxShadow: "0 4px 10px rgba(0,0,0,0.06)",
                  border: "3px solid #2b2b2b",
                  fontSize: 84,
                  fontWeight: 800,
                  color: "#1b1b1b",
                  fontFamily: "Arial, Helvetica, sans-serif"
                },
                children: cell
              },
              `header-${rIdx}-${cIdx}`,
              false,
              {
                fileName: "<stdin>",
                lineNumber: 353,
                columnNumber: 23
              },
              this
            );
          }
          const cardRowIndex = rIdx - 1;
          const cardCell = exampleCard[cardRowIndex][cIdx];
          const isFree = typeof cardCell === "string" && cardCell.toLowerCase().includes("free");
          const num = Number(cardCell);
          const isCalled = !isFree && Number.isFinite(num) && calledNumbers.includes(num);
          const tapped = actions.some(
            (a) => a.type === "tap" && a.r === cardRowIndex && a.c === cIdx
          );
          return /* @__PURE__ */ jsxDEV(
            "button",
            {
              onClick: () => handleCellTap(cardRowIndex, cIdx),
              className: isCalled && !isFree ? "bingo-called" : "",
              style: {
                width: 150,
                height: 150,
                borderRadius: 12,
                border: "3px solid #2b2b2b",
                background: isFree ? "#efefef" : "#fff",
                fontWeight: 700,
                fontSize: 56,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                overflow: "hidden",
                cursor: "pointer",
                color: "#111",
                fontFamily: "Arial, Helvetica, sans-serif"
              },
              children: [
                tapped && /* @__PURE__ */ jsxDEV(
                  "div",
                  {
                    style: {
                      position: "absolute",
                      width: 74,
                      height: 74,
                      borderRadius: 999,
                      background: "#ff6b6b",
                      opacity: 0.95,
                      zIndex: 0
                    }
                  },
                  void 0,
                  false,
                  {
                    fileName: "<stdin>",
                    lineNumber: 416,
                    columnNumber: 25
                  },
                  this
                ),
                /* @__PURE__ */ jsxDEV("div", { style: { zIndex: 1 }, children: isFree ? "FREE" : cardCell }, void 0, false, {
                  fileName: "<stdin>",
                  lineNumber: 428,
                  columnNumber: 23
                }, this)
              ]
            },
            `${rIdx}-${cIdx}`,
            true,
            {
              fileName: "<stdin>",
              lineNumber: 393,
              columnNumber: 21
            },
            this
          );
        })
      ) }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 345,
        columnNumber: 13
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 246,
      columnNumber: 11
    }, this) }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 234,
      columnNumber: 9
    }, this) }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 232,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV("div", { style: { width: 360, height: 640, display: "flex", alignItems: "center", justifyContent: "center" }, children: /* @__PURE__ */ jsxDEV("div", { style: { width: "100%", height: "100%", boxSizing: "border-box", borderRadius: 12, overflow: "hidden", boxShadow: "0 12px 36px rgba(0,0,0,0.12)" }, children: /* @__PURE__ */ jsxDEV(
      Player,
      {
        component: BingoCardClip,
        durationInFrames: matchForPlayer.durationInFrames || 150,
        fps: 30,
        compositionWidth: 1080,
        compositionHeight: 1920,
        loop: true,
        controls: true,
        inputProps: { match: matchForPlayer },
        autoplay: true,
        numberOfSharedAudioTags: 10,
        style: { width: "100%", height: "100%" }
      },
      playerKey + (isReplayMode ? "-replay" : ""),
      false,
      {
        fileName: "<stdin>",
        lineNumber: 443,
        columnNumber: 11
      },
      this
    ) }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 442,
      columnNumber: 9
    }, this) }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 441,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV("div", { style: { width: 360, boxSizing: "border-box", padding: 12, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12 }, children: [
      /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", gap: 8 }, children: [
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: () => {
              setIsReplayMode(true);
              setPlayerKey((k) => k + 1);
            },
            style: { padding: "8px 12px", borderRadius: 8, background: "#1b9fff", color: "#fff", border: "none", fontSize: 14 },
            children: "Render Replay"
          },
          void 0,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 463,
            columnNumber: 11
          },
          this
        ),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: clearActions,
            style: { padding: "8px 12px", borderRadius: 8, background: "#eee", border: "none", fontSize: 14 },
            children: "Clear"
          },
          void 0,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 469,
            columnNumber: 11
          },
          this
        )
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 462,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDEV("div", { style: { width: "100%", fontSize: 12 }, children: [
        /* @__PURE__ */ jsxDEV("div", { style: { fontWeight: 700, marginBottom: 6 }, children: "Recorded actions JSON" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 478,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("pre", { style: { whiteSpace: "pre-wrap", wordBreak: "break-word", background: "#f7f7f7", padding: 8, borderRadius: 6, maxHeight: 420, overflow: "auto" }, children: JSON.stringify(actions, null, 2) }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 479,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 477,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 461,
      columnNumber: 7
    }, this)
  ] }, void 0, true, {
    fileName: "<stdin>",
    lineNumber: 230,
    columnNumber: 5
  }, this);
}
createRoot(document.getElementById("app")).render(/* @__PURE__ */ jsxDEV(InteractiveApp, {}, void 0, false, {
  fileName: "<stdin>",
  lineNumber: 488,
  columnNumber: 51
}));
