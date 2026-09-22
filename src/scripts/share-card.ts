export interface ShareCardData {
  challengeName: string;
  dayNumber: number;
  totalDays: number;
  currentStreak: number;
  activities: Array<{ name: string; completedCount: number }>;
  milestoneTitle?: string;
  isStake?: boolean;
  stakeAmountText?: string;
}

export function drawShareCard(canvas: HTMLCanvasElement, data: ShareCardData) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = 1200;
  const height = 630;
  canvas.width = width;
  canvas.height = height;

  // Background warm canvas
  ctx.fillStyle = '#FAFAF7';
  ctx.fillRect(0, 0, width, height);

  // Border & Inner card
  ctx.strokeStyle = '#E9E8E2';
  ctx.lineWidth = 3;
  ctx.strokeRect(36, 36, width - 72, height - 72);

  // Decorative subtle grid dot pattern
  ctx.fillStyle = '#EAE9E2';
  for (let x = 60; x < width - 60; x += 40) {
    for (let y = 60; y < height - 60; y += 40) {
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Top header text
  ctx.fillStyle = '#777B78';
  ctx.font = '600 20px Inter, system-ui, sans-serif';
  ctx.fillText('STREAKGRID CHALLENGE REPORT', 72, 94);

  // Milestone / Streak Pill
  const streakText = data.milestoneTitle || `🔥 ${data.currentStreak} DAY STREAK`;
  ctx.font = '700 22px Inter, system-ui, sans-serif';
  const textWidth = ctx.measureText(streakText).width;

  // Streak Pill background
  ctx.fillStyle = '#FEF3C7';
  ctx.beginPath();
  ctx.roundRect(72, 120, textWidth + 32, 40, 8);
  ctx.fill();

  ctx.strokeStyle = '#FDE68A';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Streak Pill text
  ctx.fillStyle = '#D97706';
  ctx.fillText(streakText, 88, 148);

  // If Stake Challenge: render Stake Badge alongside
  if (data.isStake) {
    const stakeBadgeX = 72 + textWidth + 48;
    const stakeText = data.stakeAmountText ? `● STAKE COMMITTED (${data.stakeAmountText})` : '● STAKE COMMITTED';
    ctx.font = '700 18px Inter, system-ui, sans-serif';
    const stakeWidth = ctx.measureText(stakeText).width;

    ctx.fillStyle = '#ECFDF5';
    ctx.beginPath();
    ctx.roundRect(stakeBadgeX, 120, stakeWidth + 30, 40, 8);
    ctx.fill();

    ctx.strokeStyle = '#A7F3D0';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#059669';
    ctx.fillText(stakeText, stakeBadgeX + 15, 147);
  }

  // Challenge Title
  ctx.fillStyle = '#171918';
  ctx.font = '800 46px Inter, system-ui, sans-serif';
  const title = data.challengeName.length > 32 ? data.challengeName.substring(0, 30) + '...' : data.challengeName;
  ctx.fillText(title, 72, 222);

  // Progress numbers
  ctx.fillStyle = '#22C55E';
  ctx.font = '700 30px Inter, system-ui, sans-serif';
  const progressText = `Day ${data.dayNumber} of ${data.totalDays} Days`;
  ctx.fillText(progressText, 72, 272);

  // Progress Bar
  const barWidth = 600;
  const barHeight = 12;
  const progressRatio = Math.min(1, Math.max(0, data.dayNumber / data.totalDays));

  ctx.fillStyle = '#E5E7EB';
  ctx.beginPath();
  ctx.roundRect(72, 296, barWidth, barHeight, 6);
  ctx.fill();

  ctx.fillStyle = '#22C55E';
  ctx.beginPath();
  ctx.roundRect(72, 296, Math.max(14, barWidth * progressRatio), barHeight, 6);
  ctx.fill();

  // Activities Box
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(72, 338, width - 144, 160, 10);
  ctx.fill();

  ctx.strokeStyle = '#E9E8E2';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Activities Title
  ctx.fillStyle = '#777B78';
  ctx.font = '600 15px Inter, system-ui, sans-serif';
  ctx.fillText('CONSISTENCY BREAKDOWN', 96, 370);

  // Draw activity list
  const maxActivities = Math.min(5, data.activities.length);
  const colSpacing = (width - 192) / Math.max(1, maxActivities);

  for (let i = 0; i < maxActivities; i++) {
    const act = data.activities[i];
    const xPos = 96 + i * colSpacing;
    const yPos = 408;

    ctx.fillStyle = '#171918';
    ctx.font = '600 18px Inter, system-ui, sans-serif';
    ctx.fillText(act.name, xPos, yPos);

    // Green check & count
    ctx.fillStyle = '#22C55E';
    ctx.font = '700 20px Inter, system-ui, sans-serif';
    ctx.fillText(`✓ ${act.completedCount} days`, xPos, yPos + 32);
  }

  // Footer Branding
  ctx.fillStyle = '#777B78';
  ctx.font = '500 17px Inter, system-ui, sans-serif';
  ctx.fillText(
    data.isStake ? 'Put something meaningful on the line • Tracked with StreakGrid' : 'Tracked with StreakGrid • Simple boxes on top.',
    72,
    556
  );

  ctx.fillStyle = '#22C55E';
  ctx.font = '700 18px Inter, system-ui, sans-serif';
  ctx.fillText('streakgrid.app', width - 210, 556);
}

export function downloadCardAsPng(canvas: HTMLCanvasElement, filename: string = 'streakgrid-achievement.png') {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export async function copyCardToClipboard(canvas: HTMLCanvasElement): Promise<boolean> {
  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        resolve(false);
        return;
      }
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        resolve(true);
      } catch (err) {
        console.error('Clipboard copy failed:', err);
        resolve(false);
      }
    });
  });
}
