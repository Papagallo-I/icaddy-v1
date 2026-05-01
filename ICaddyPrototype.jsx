import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ClipboardList, Flag, Target, User, RotateCcw, AlertTriangle } from "lucide-react";

const STORAGE_KEY = "icaddy_v1_local_state";

const initialProfile = {
  name: "",
  handicapRange: "",
  usualScoreRange: "",
  scoringGoal: "Break 80",
  typicalMiss: "",
  bestClub: "",
  worstClub: "",
  driverCarry: "",
  sevenIronCarry: "",
  pitchingWedgeCarry: "",
  commonPenalty: "",
  shortGameWeakness: "",
  puttingWeakness: "",
  emotionalTendency: "",
  riskTendency: "",
  roundDestroyer: "",
};

const initialRound = {
  courseName: "",
  teeBox: "",
  weatherNotes: "",
  startedAt: "",
};

const initialShot = {
  holeNumber: "1",
  shotNumber: "1",
  distanceToTarget: "",
  lie: "",
  wind: "",
  intendedTarget: "",
  troubleLeft: "No",
  troubleRight: "No",
  troubleShort: "No",
  troubleLong: "No",
  intendedShot: "",
  confidenceLevel: "Medium",
  emotionalState: "Calm",
  previousShotQuality: "Neutral",
  playerDecision: "",
  overrideReason: "",
  contactQuality: "",
  startDirection: "",
  curveMiss: "",
  distanceResult: "",
  finalPosition: "",
  penalty: "No",
  decisionQuality: "",
  wouldRepeatDecision: "",
  notes: "",
};

function optionList(values) {
  return values.map((value) => (
    <SelectItem key={value} value={value}>
      {value}
    </SelectItem>
  ));
}

function Field({ label, children, hint }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function TextField({ label, value, onChange, placeholder, type = "text", hint }) {
  return (
    <Field label={label} hint={hint}>
      <Input value={value} type={type} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

function SelectField({ label, value, onChange, options, placeholder = "Select" }) {
  return (
    <Field label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{optionList(options)}</SelectContent>
      </Select>
    </Field>
  );
}

function buildRecommendation(profile, shot) {
  const triggeredRules = [];
  let aim = "center target";
  let clubAdvice = "stock club";
  let targetZone = "largest safe landing area";
  const reasons = [];
  const warnings = [];

  const miss = profile.typicalMiss;
  const troubleLeft = shot.troubleLeft === "Yes";
  const troubleRight = shot.troubleRight === "Yes";
  const troubleShort = shot.troubleShort === "Yes";
  const troubleLong = shot.troubleLong === "Yes";
  const meaningfulTrouble = troubleLeft || troubleRight || troubleShort || troubleLong;

  // Rule 1: Trouble + Miss Bias
  if (miss === "Left" && troubleLeft) {
    triggeredRules.push("Trouble + Miss Bias");
    aim = "center-right";
    reasons.push("Your common miss is left and trouble is left. The disciplined play is to aim away from that side.");
    warnings.push("Do not let your usual miss bring the left trouble into play.");
  }

  if (miss === "Right" && troubleRight) {
    triggeredRules.push("Trouble + Miss Bias");
    aim = "center-left";
    reasons.push("Your common miss is right and trouble is right. The disciplined play is to aim away from that side.");
    warnings.push("Do not let your usual miss bring the right trouble into play.");
  }

  // Rule 2: Short-Side Protection
  if (troubleShort || shot.intendedTarget.toLowerCase().includes("pin")) {
    triggeredRules.push("Short-Side Protection");
    targetZone = "center of the green or widest safe area";
    reasons.push("This shot has short-side or pin-chasing risk. Center target keeps the round stable.");
    warnings.push("Do not short-side yourself from here.");
  }

  // Rule 3: Low Confidence Adjustment
  if (shot.confidenceLevel === "Low") {
    triggeredRules.push("Low Confidence Adjustment");
    aim = aim === "center target" ? "safe side of target" : aim;
    targetZone = "larger landing area";
    reasons.push("Your confidence is low, so the target should get bigger and the shot should get simpler.");
    warnings.push("Avoid a precise shot that requires perfect execution.");
  }

  // Rule 4: Emotional State Control
  if (["Frustrated", "Angry", "Rushed", "Reactive"].includes(shot.emotionalState)) {
    triggeredRules.push("Emotional State Control");
    aim = "center target";
    targetZone = "safe middle area";
    reasons.push("Your current emotional state increases risk. The right play is conservative and controlled.");
    warnings.push("No make-up golf on this shot.");
  }

  // Rule 5: Distance Reality Check
  const distance = Number(shot.distanceToTarget || 0);
  const sevenIron = Number(profile.sevenIronCarry || 0);
  const pw = Number(profile.pitchingWedgeCarry || 0);
  if (distance && sevenIron && Math.abs(distance - sevenIron) <= 5) {
    triggeredRules.push("Distance Reality Check");
    clubAdvice = "one extra club with smooth swing";
    reasons.push("The distance is near a max carry number. Take enough club and avoid forcing it.");
    warnings.push("Do not swing harder just to cover the number.");
  } else if (distance && pw && Math.abs(distance - pw) <= 5) {
    triggeredRules.push("Distance Reality Check");
    clubAdvice = "one extra club with controlled tempo";
    reasons.push("The distance is near a max wedge carry number. Controlled contact beats forced distance.");
    warnings.push("Do not try to squeeze extra yardage out of the club.");
  }

  // Rule 6: Aggression Check
  const aggressiveIntent = ["At pin", "Attack", "Hero shot", "Carry trouble"].includes(shot.intendedShot);
  if (aggressiveIntent && meaningfulTrouble) {
    triggeredRules.push("Aggression Check");
    aim = aim === "center target" ? "safe side of target" : aim;
    targetZone = "safe side / center";
    reasons.push("Your intended shot is aggressive and trouble is present. The recommendation is to remove the big number.");
    warnings.push("Do not chase the hero version of this shot.");
  }

  // Rule 7: Recovery Discipline
  if (["Trees", "Deep rough", "Bunker", "Trouble"].includes(shot.lie)) {
    triggeredRules.push("Recovery Discipline");
    aim = "safe exit line";
    clubAdvice = "club that guarantees recovery";
    targetZone = "back in play";
    reasons.push("Your lie calls for recovery discipline. First priority is returning the ball to a safe position.");
    warnings.push("Do not turn one mistake into two.");
  }

  // Rule 8: Overcompensation Guard
  if (["Bad", "Penalty"].includes(shot.previousShotQuality) && ["Frustrated", "Angry", "Reactive"].includes(shot.emotionalState)) {
    triggeredRules.push("Overcompensation Guard");
    aim = "center target";
    reasons.push("The previous shot was poor and your state is reactive. This is exactly when make-up aggression costs strokes.");
    warnings.push("Accept the situation and play the next correct shot.");
  }

  // Rule 9: Tee Shot Safety
  if (shot.shotNumber === "1" && troubleLeft && troubleRight) {
    triggeredRules.push("Tee Shot Safety");
    clubAdvice = "most reliable club off the tee";
    aim = "widest part of fairway";
    targetZone = "in play";
    reasons.push("Trouble exists on both sides. Keeping the ball in play matters more than maximum distance.");
    warnings.push("Driver is not automatic when both sides are dangerous.");
  }

  // Rule 10: Default Discipline Rule
  if (triggeredRules.length === 0) {
    triggeredRules.push("Default Discipline Rule");
    aim = "center target";
    clubAdvice = "stock club";
    targetZone = "largest safe landing area";
    reasons.push("No major red flag triggered. Use your stock shot and avoid unnecessary precision.");
    warnings.push("Do not make the shot harder than it needs to be.");
  }

  const recommendedPlay = `${clubAdvice}; aim ${aim}; play to ${targetZone}.`;
  const reason = [...new Set(reasons)].slice(0, 3).join(" ");
  const riskWarning = [...new Set(warnings)].slice(0, 2).join(" ");

  return {
    recommendedPlay,
    reason,
    riskWarning,
    triggeredRules: [...new Set(triggeredRules)],
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export default function ICaddyPrototype() {
  const saved = typeof window !== "undefined" ? loadState() : null;
  const [screen, setScreen] = useState(saved?.screen || "welcome");
  const [profile, setProfile] = useState(saved?.profile || initialProfile);
  const [round, setRound] = useState(saved?.round || initialRound);
  const [shot, setShot] = useState(saved?.shot || initialShot);
  const [shots, setShots] = useState(saved?.shots || []);

  const recommendation = useMemo(() => buildRecommendation(profile, shot), [profile, shot]);

  useEffect(() => {
    saveState({ screen, profile, round, shot, shots });
  }, [screen, profile, round, shot, shots]);

  function updateProfile(key, value) {
    setProfile((prev) => ({ ...prev, [key]: value }));
  }

  function updateRound(key, value) {
    setRound((prev) => ({ ...prev, [key]: value }));
  }

  function updateShot(key, value) {
    setShot((prev) => ({ ...prev, [key]: value }));
  }

  function startRound() {
    setRound((prev) => ({ ...prev, startedAt: prev.startedAt || new Date().toISOString() }));
    setScreen("shot");
  }

  function saveShot() {
    const savedShot = {
      id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()),
      createdAt: new Date().toISOString(),
      profileSnapshot: profile,
      roundSnapshot: round,
      situation: shot,
      recommendation,
    };
    setShots((prev) => [...prev, savedShot]);
    setShot((prev) => ({
      ...initialShot,
      holeNumber: prev.holeNumber,
      shotNumber: String(Number(prev.shotNumber || 1) + 1),
      previousShotQuality: prev.decisionQuality === "Bad" || prev.penalty === "Yes" ? "Bad" : "Neutral",
    }));
    setScreen("shot");
  }

  function nextHole() {
    setShot((prev) => ({ ...initialShot, holeNumber: String(Number(prev.holeNumber || 1) + 1), shotNumber: "1" }));
    setScreen("shot");
  }

  function resetPrototype() {
    localStorage.removeItem(STORAGE_KEY);
    setScreen("welcome");
    setProfile(initialProfile);
    setRound(initialRound);
    setShot(initialShot);
    setShots([]);
  }

  const Header = () => (
    <div className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">i-Caddy v1.0</h1>
          <p className="text-xs text-slate-500">Disciplined decision journal with a caddy brain</p>
        </div>
        <Button variant="outline" size="sm" onClick={resetPrototype}>
          <RotateCcw className="mr-1 h-4 w-4" /> Reset
        </Button>
      </div>
    </div>
  );

  const Progress = () => {
    const steps = [
      ["profile", "Profile"],
      ["round", "Round"],
      ["shot", "Shot"],
      ["recommendation", "Caddy"],
      ["outcome", "Outcome"],
      ["summary", "Log"],
    ];
    return (
      <div className="mb-4 flex flex-wrap gap-2">
        {steps.map(([key, label]) => (
          <Badge key={key} variant={screen === key ? "default" : "secondary"} className="rounded-full">
            {label}
          </Badge>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Progress />
        <motion.div key={screen} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          {screen === "welcome" && (
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="space-y-6 p-6">
                <div className="space-y-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
                    <Flag className="h-6 w-6" />
                  </div>
                  <h2 className="text-2xl font-bold">Field Prototype</h2>
                  <p className="text-slate-600">
                    This version stores data locally in this browser. It proves the loop before backend, login, and deployment are added.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <User className="mb-2 h-5 w-5" />
                    <p className="font-semibold">Profile</p>
                    <p className="text-sm text-slate-500">Know the player.</p>
                  </div>
                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <Target className="mb-2 h-5 w-5" />
                    <p className="font-semibold">Decision</p>
                    <p className="text-sm text-slate-500">Guide the shot.</p>
                  </div>
                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <ClipboardList className="mb-2 h-5 w-5" />
                    <p className="font-semibold">Log</p>
                    <p className="text-sm text-slate-500">Capture outcome.</p>
                  </div>
                </div>
                <Button className="w-full" onClick={() => setScreen("profile")}>Start Prototype</Button>
              </CardContent>
            </Card>
          )}

          {screen === "profile" && (
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="space-y-5 p-6">
                <div>
                  <h2 className="text-2xl font-bold">Player Profile</h2>
                  <p className="text-slate-600">Initial profile is self-reported. Shot logs will later reveal the truth.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="Name" value={profile.name} onChange={(v) => updateProfile("name", v)} placeholder="Player name" />
                  <SelectField label="Handicap range" value={profile.handicapRange} onChange={(v) => updateProfile("handicapRange", v)} options={["0-5", "6-10", "11-15", "16-20", "21-25", "26+"]} />
                  <SelectField label="Usual score range" value={profile.usualScoreRange} onChange={(v) => updateProfile("usualScoreRange", v)} options={["70s", "80-85", "86-90", "91-100", "100+"]} />
                  <TextField label="Primary scoring goal" value={profile.scoringGoal} onChange={(v) => updateProfile("scoringGoal", v)} placeholder="Break 80" />
                  <SelectField label="Typical miss" value={profile.typicalMiss} onChange={(v) => updateProfile("typicalMiss", v)} options={["Left", "Right", "Short", "Long", "Two-way miss", "Thin", "Fat"]} />
                  <TextField label="Best club" value={profile.bestClub} onChange={(v) => updateProfile("bestClub", v)} placeholder="Example: 7-iron" />
                  <TextField label="Worst club" value={profile.worstClub} onChange={(v) => updateProfile("worstClub", v)} placeholder="Example: Driver" />
                  <TextField label="Driver carry" value={profile.driverCarry} onChange={(v) => updateProfile("driverCarry", v)} placeholder="Yards" type="number" />
                  <TextField label="7-iron carry" value={profile.sevenIronCarry} onChange={(v) => updateProfile("sevenIronCarry", v)} placeholder="Yards" type="number" />
                  <TextField label="Pitching wedge carry" value={profile.pitchingWedgeCarry} onChange={(v) => updateProfile("pitchingWedgeCarry", v)} placeholder="Yards" type="number" />
                  <SelectField label="Most common penalty" value={profile.commonPenalty} onChange={(v) => updateProfile("commonPenalty", v)} options={["Out of bounds", "Water", "Trees", "Lost ball", "Bunker", "None"]} />
                  <SelectField label="Risk tendency" value={profile.riskTendency} onChange={(v) => updateProfile("riskTendency", v)} options={["Conservative", "Balanced", "Aggressive", "Too aggressive after bad shots"]} />
                </div>
                <TextField label="Short-game weakness" value={profile.shortGameWeakness} onChange={(v) => updateProfile("shortGameWeakness", v)} placeholder="Example: bunker shots, chips from tight lies" />
                <TextField label="Putting weakness" value={profile.puttingWeakness} onChange={(v) => updateProfile("puttingWeakness", v)} placeholder="Example: lag putting, short putts" />
                <TextField label="Emotional tendency under pressure" value={profile.emotionalTendency} onChange={(v) => updateProfile("emotionalTendency", v)} placeholder="Example: rushes after a bad hole" />
                <Field label="What usually ruins your round?">
                  <Textarea value={profile.roundDestroyer} onChange={(e) => updateProfile("roundDestroyer", e.target.value)} placeholder="Be honest. Ego, penalties, driver, anger, three-putts, hero shots..." />
                </Field>
                <Button className="w-full" onClick={() => setScreen("round")}>Save Profile</Button>
              </CardContent>
            </Card>
          )}

          {screen === "round" && (
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="space-y-5 p-6">
                <div>
                  <h2 className="text-2xl font-bold">Start Round</h2>
                  <p className="text-slate-600">Keep this simple. The purpose is decision data.</p>
                </div>
                <TextField label="Course name" value={round.courseName} onChange={(v) => updateRound("courseName", v)} placeholder="Example: Forest Creek" />
                <TextField label="Tee box" value={round.teeBox} onChange={(v) => updateRound("teeBox", v)} placeholder="Example: White" />
                <Field label="Weather notes">
                  <Textarea value={round.weatherNotes} onChange={(e) => updateRound("weatherNotes", e.target.value)} placeholder="Windy, wet, hot, firm greens, etc." />
                </Field>
                <Button className="w-full" onClick={startRound}>Start Round</Button>
              </CardContent>
            </Card>
          )}

          {screen === "shot" && (
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="space-y-5 p-6">
                <div>
                  <h2 className="text-2xl font-bold">Tell i-Caddy what you’re looking at.</h2>
                  <p className="text-slate-600">Describe reality before deciding.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="Hole" value={shot.holeNumber} onChange={(v) => updateShot("holeNumber", v)} type="number" />
                  <TextField label="Shot" value={shot.shotNumber} onChange={(v) => updateShot("shotNumber", v)} type="number" />
                  <TextField label="Approx. distance to target" value={shot.distanceToTarget} onChange={(v) => updateShot("distanceToTarget", v)} placeholder="Yards" type="number" />
                  <SelectField label="Lie" value={shot.lie} onChange={(v) => updateShot("lie", v)} options={["Tee", "Fairway", "First cut", "Rough", "Deep rough", "Trees", "Bunker", "Trouble", "Green"]} />
                  <SelectField label="Wind" value={shot.wind} onChange={(v) => updateShot("wind", v)} options={["None", "Into", "Helping", "Left to right", "Right to left", "Swirling"]} />
                  <SelectField label="Intended target" value={shot.intendedTarget} onChange={(v) => updateShot("intendedTarget", v)} options={["Center fairway", "Left fairway", "Right fairway", "Center green", "Left green", "Right green", "Pin", "Layup zone", "Safe exit"]} />
                  <SelectField label="Trouble left" value={shot.troubleLeft} onChange={(v) => updateShot("troubleLeft", v)} options={["No", "Yes"]} />
                  <SelectField label="Trouble right" value={shot.troubleRight} onChange={(v) => updateShot("troubleRight", v)} options={["No", "Yes"]} />
                  <SelectField label="Trouble short" value={shot.troubleShort} onChange={(v) => updateShot("troubleShort", v)} options={["No", "Yes"]} />
                  <SelectField label="Trouble long" value={shot.troubleLong} onChange={(v) => updateShot("troubleLong", v)} options={["No", "Yes"]} />
                  <SelectField label="Intended shot" value={shot.intendedShot} onChange={(v) => updateShot("intendedShot", v)} options={["Stock shot", "At pin", "Attack", "Layup", "Punch out", "Hero shot", "Carry trouble", "Safe miss"]} />
                  <SelectField label="Confidence" value={shot.confidenceLevel} onChange={(v) => updateShot("confidenceLevel", v)} options={["High", "Medium", "Low"]} />
                  <SelectField label="Emotional state" value={shot.emotionalState} onChange={(v) => updateShot("emotionalState", v)} options={["Calm", "Focused", "Frustrated", "Angry", "Rushed", "Reactive"]} />
                  <SelectField label="Previous shot quality" value={shot.previousShotQuality} onChange={(v) => updateShot("previousShotQuality", v)} options={["Good", "Neutral", "Bad", "Penalty"]} />
                </div>
                <Button className="w-full" onClick={() => setScreen("recommendation")}>Get Recommendation</Button>
              </CardContent>
            </Card>
          )}

          {screen === "recommendation" && (
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="space-y-5 p-6">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
                    <Target className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">i-Caddy Recommendation</h2>
                    <p className="text-slate-600">Calm, direct, disciplined.</p>
                  </div>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-slate-500">Recommended play</p>
                  <p className="mt-1 text-xl font-bold">{recommendation.recommendedPlay}</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-slate-500">Reason</p>
                  <p className="mt-1 text-slate-700">{recommendation.reason}</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex gap-2">
                    <AlertTriangle className="mt-0.5 h-5 w-5" />
                    <div>
                      <p className="font-semibold">Risk warning</p>
                      <p className="text-slate-700">{recommendation.riskWarning}</p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recommendation.triggeredRules.map((rule) => (
                    <Badge key={rule} variant="secondary" className="rounded-full">{rule}</Badge>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button onClick={() => { updateShot("playerDecision", "Follow i-Caddy"); setScreen("outcome"); }}>
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Follow i-Caddy
                  </Button>
                  <Button variant="outline" onClick={() => { updateShot("playerDecision", "Take own risk"); setScreen("decision-risk"); }}>
                    Take my own risk
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {screen === "decision-risk" && (
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="space-y-5 p-6">
                <div>
                  <h2 className="text-2xl font-bold">Why override?</h2>
                  <p className="text-slate-600">Risk is allowed. We log it honestly.</p>
                </div>
                <SelectField label="Override reason" value={shot.overrideReason} onChange={(v) => updateShot("overrideReason", v)} options={["I feel confident", "I want to attack", "I disagree with recommendation", "I need to make up strokes", "Other"]} />
                <Button className="w-full" onClick={() => setScreen("outcome")}>Continue to Shot Outcome</Button>
              </CardContent>
            </Card>
          )}

          {screen === "outcome" && (
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="space-y-5 p-6">
                <div>
                  <h2 className="text-2xl font-bold">What happened?</h2>
                  <p className="text-slate-600">Log the result immediately after the shot.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <SelectField label="Contact quality" value={shot.contactQuality} onChange={(v) => updateShot("contactQuality", v)} options={["Solid", "Thin", "Fat", "Toe", "Heel", "Chunk", "Top"]} />
                  <SelectField label="Start direction" value={shot.startDirection} onChange={(v) => updateShot("startDirection", v)} options={["Left", "Target", "Right"]} />
                  <SelectField label="Curve / miss" value={shot.curveMiss} onChange={(v) => updateShot("curveMiss", v)} options={["None", "Draw", "Fade", "Hook", "Slice", "Pull", "Push"]} />
                  <SelectField label="Distance result" value={shot.distanceResult} onChange={(v) => updateShot("distanceResult", v)} options={["Short", "Pin high", "Long", "Unknown"]} />
                  <SelectField label="Final position" value={shot.finalPosition} onChange={(v) => updateShot("finalPosition", v)} options={["Fairway", "Rough", "Green", "Bunker", "Water", "Trees", "Out of bounds", "Lost", "Safe recovery", "Holed"]} />
                  <SelectField label="Penalty?" value={shot.penalty} onChange={(v) => updateShot("penalty", v)} options={["No", "Yes"]} />
                  <SelectField label="Was the decision good?" value={shot.decisionQuality} onChange={(v) => updateShot("decisionQuality", v)} options={["Good", "Neutral", "Bad"]} />
                  <SelectField label="Would you make same decision again?" value={shot.wouldRepeatDecision} onChange={(v) => updateShot("wouldRepeatDecision", v)} options={["Yes", "No", "Unsure"]} />
                </div>
                <Field label="Optional notes">
                  <Textarea value={shot.notes} onChange={(e) => updateShot("notes", e.target.value)} placeholder="What mattered here?" />
                </Field>
                <Button className="w-full" onClick={saveShot}>Save Shot</Button>
              </CardContent>
            </Card>
          )}

          {screen === "summary" && (
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="space-y-5 p-6">
                <div>
                  <h2 className="text-2xl font-bold">Round Log</h2>
                  <p className="text-slate-600">{shots.length} shots captured in this browser.</p>
                </div>
                <div className="space-y-3">
                  {shots.length === 0 && <p className="text-slate-500">No shots logged yet.</p>}
                  {shots.slice().reverse().map((entry) => (
                    <div key={entry.id} className="rounded-2xl bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold">Hole {entry.situation.holeNumber}, Shot {entry.situation.shotNumber}</p>
                        <Badge variant={entry.situation.playerDecision === "Follow i-Caddy" ? "default" : "secondary"}>{entry.situation.playerDecision}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-slate-600"><strong>Recommendation:</strong> {entry.recommendation.recommendedPlay}</p>
                      <p className="mt-1 text-sm text-slate-600"><strong>Outcome:</strong> {entry.situation.finalPosition || "Not recorded"} · Decision: {entry.situation.decisionQuality || "Not rated"}</p>
                    </div>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button onClick={() => setScreen("shot")}>Log Another Shot</Button>
                  <Button variant="outline" onClick={nextHole}>Next Hole</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
        {screen !== "summary" && shots.length > 0 && (
          <div className="mt-4">
            <Button variant="ghost" className="w-full" onClick={() => setScreen("summary")}>View Round Log ({shots.length})</Button>
          </div>
        )}
      </main>
    </div>
  );
}
 
