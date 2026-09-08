import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated as RNAnimated,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { DailyInstance, ScheduleBlock, BlockTask } from "../types/database";
import { Colors, spacing, radii, typography } from "../theme";
import { useTheme } from "../providers/ThemeProvider";
import { PressableScale } from "./PressableScale";
import { BrandLoader } from "./BrandLoader";
import { hapticSelect } from "../lib/haptics";
import { formatDayLabel } from "../lib/time";
import { addDays } from "../lib/stats";
import { runsOn, upcomingRunDates } from "../lib/recurrence";

interface BlockTaskSheetProps {
  visible: boolean;
  instance: DailyInstance | null;
  task: BlockTask | null;
  blocks: ScheduleBlock[];
  slideAnim: RNAnimated.Value;
  scrimAnim: RNAnimated.Value;
  saving: boolean;
  onChangeName: (name: string) => void;
  name: string;
  onCreate: () => void;
  onRename: () => void;
  onToggleDone: () => void;
  onDelete: () => void;
  onMove: (blockId: string, date: string) => void;
  onClose: () => void;
  isAdd: boolean;
}

export function BlockTaskSheet({
  visible,
  instance,
  task,
  blocks,
  slideAnim,
  scrimAnim,
  saving,
  name,
  onChangeName,
  onCreate,
  onRename,
  onToggleDone,
  onDelete,
  onMove,
  onClose,
  isAdd,
}: BlockTaskSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const sourceBlock =
    instance?.block ?? blocks.find((b) => b.id === instance?.block_id);
  const fromDate = instance?.date ? addDays(instance.date, 1) : "";
  const dateOptions = useMemo(() => {
    if (!sourceBlock || !fromDate) return [];
    return upcomingRunDates(sourceBlock, fromDate, 8);
  }, [sourceBlock, fromDate]);

  const [moveDate, setMoveDate] = useState<string | null>(null);
  const [moveBlockId, setMoveBlockId] = useState<string | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);

  const firstDate = dateOptions[0] ?? null;

  useEffect(() => {
    if (!visible) return;
    setMoveDate(firstDate);
    setMoveBlockId(instance?.block_id ?? null);
    setMoveOpen(false);
  }, [visible, instance?.block_id, firstDate]);

  const destBlocks = useMemo(() => {
    if (!moveDate) return [];
    const list = blocks.filter((b) => b.is_active && runsOn(b, moveDate));
    if (list.length > 0) return list;
    if (sourceBlock && runsOn(sourceBlock, moveDate)) {
      return [sourceBlock as ScheduleBlock];
    }
    return [];
  }, [blocks, moveDate, sourceBlock]);

  const canSubmit = name.trim().length > 0;
  const canMove =
    !!task &&
    !!moveDate &&
    !!moveBlockId &&
    (moveDate !== task.date || moveBlockId !== task.block_id);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <RNAnimated.View
          style={[styles.scrim, { opacity: scrimAnim }]}
          pointerEvents="none"
        />
        <KeyboardAvoidingView
          style={styles.overlayPressable}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Pressable style={styles.dismiss} onPress={onClose} />
          <Pressable onPress={(e) => e.stopPropagation()}>
            <RNAnimated.View
              style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
            >
              <View style={styles.handle} />
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
                contentContainerStyle={styles.sheetContent}
              >
              <Text style={styles.title}>
                {isAdd ? "Add task" : instance?.block?.name ?? "Task"}
              </Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={onChangeName}
                placeholder="e.g. Chest day + 20 min run"
                placeholderTextColor={colors.textPlaceholder}
                autoFocus={isAdd}
              />

              {isAdd ? (
                <PressableScale
                  style={[styles.saveBtn, !canSubmit && styles.saveBtnDisabled]}
                  onPress={onCreate}
                  disabled={saving || !canSubmit}
                >
                  {saving ? (
                    <BrandLoader size={20} />
                  ) : (
                    <Text style={styles.saveBtnText}>Add</Text>
                  )}
                </PressableScale>
              ) : (
                <>
                  <PressableScale
                    style={[styles.saveBtn, !canSubmit && styles.saveBtnDisabled]}
                    onPress={onRename}
                    disabled={saving || !canSubmit}
                  >
                    {saving ? (
                      <BrandLoader size={20} />
                    ) : (
                      <Text style={styles.saveBtnText}>Save name</Text>
                    )}
                  </PressableScale>
                  <PressableScale
                    style={styles.secondaryBtn}
                    onPress={onToggleDone}
                    disabled={saving}
                  >
                    <Text style={styles.secondaryBtnText}>
                      {task?.done ? "Mark not done" : "Mark done"}
                    </Text>
                  </PressableScale>

                  <PressableScale
                    style={styles.secondaryBtn}
                    onPress={() => {
                      hapticSelect();
                      setMoveOpen((v) => !v);
                    }}
                    disabled={saving || dateOptions.length === 0}
                  >
                    <Text style={styles.secondaryBtnText}>
                      {moveOpen ? "Hide move" : "Move"}
                    </Text>
                  </PressableScale>

                  {moveOpen ? (
                    <View style={styles.moveBox}>
                      <Text style={styles.moveLabel}>Date</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.chipRow}
                      >
                        {dateOptions.map((d) => (
                          <PressableScale
                            key={d}
                            style={[
                              styles.chip,
                              moveDate === d && styles.chipOn,
                            ]}
                            onPress={() => {
                              hapticSelect();
                              setMoveDate(d);
                              const dest = blocks.filter(
                                (b) => b.is_active && runsOn(b, d)
                              );
                              setMoveBlockId((current) => {
                                if (current && dest.some((b) => b.id === current)) {
                                  return current;
                                }
                                if (
                                  instance?.block_id &&
                                  dest.some((b) => b.id === instance.block_id)
                                ) {
                                  return instance.block_id;
                                }
                                return dest[0]?.id ?? null;
                              });
                            }}
                          >
                            <Text
                              style={[
                                styles.chipText,
                                moveDate === d && styles.chipTextOn,
                              ]}
                            >
                              {formatDayLabel(d)}
                            </Text>
                          </PressableScale>
                        ))}
                      </ScrollView>
                      <Text style={styles.moveLabel}>Block</Text>
                      {destBlocks.map((b) => (
                        <PressableScale
                          key={b.id}
                          style={[
                            styles.blockPick,
                            moveBlockId === b.id && styles.chipOn,
                          ]}
                          onPress={() => {
                            hapticSelect();
                            setMoveBlockId(b.id);
                          }}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              moveBlockId === b.id && styles.chipTextOn,
                            ]}
                          >
                            {b.name}
                            {b.id === instance?.block_id ? " (same)" : ""}
                          </Text>
                        </PressableScale>
                      ))}
                      <PressableScale
                        style={[styles.saveBtn, !canMove && styles.saveBtnDisabled]}
                        onPress={() => {
                          if (!canMove || !moveDate || !moveBlockId) return;
                          onMove(moveBlockId, moveDate);
                        }}
                        disabled={saving || !canMove}
                      >
                        {saving ? (
                          <BrandLoader size={20} />
                        ) : (
                          <Text style={styles.saveBtnText}>Move task</Text>
                        )}
                      </PressableScale>
                    </View>
                  ) : null}

                  <TouchableOpacity onPress={onDelete} disabled={saving}>
                    <Text style={styles.deleteText}>Delete</Text>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity onPress={onClose} disabled={saving}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              </ScrollView>
            </RNAnimated.View>
          </Pressable>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: "flex-end",
    },
    scrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: c.overlayScrim,
    },
    overlayPressable: {
      flex: 1,
      justifyContent: "flex-end",
    },
    dismiss: {
      flex: 1,
    },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: radii.pill,
      borderTopRightRadius: radii.pill,
      paddingTop: spacing.sm,
      paddingBottom: Platform.OS === "ios" ? 36 : 24,
      maxHeight: "88%",
      ...c.shadowRest,
    },
    sheetContent: {
      paddingHorizontal: spacing.xl,
      gap: spacing.md,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: radii.xs,
      backgroundColor: c.borderLight,
      alignSelf: "center",
      marginBottom: spacing.md,
    },
    title: { color: c.text, ...typography.heading },
    input: {
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
      borderRadius: radii.md,
      paddingHorizontal: 14,
      paddingVertical: spacing.md,
      color: c.text,
      ...typography.body,
    },
    saveBtn: {
      backgroundColor: c.primary,
      borderRadius: radii.lg,
      paddingVertical: 14,
      alignItems: "center",
    },
    saveBtnDisabled: {
      opacity: 0.5,
    },
    saveBtnText: { color: c.onPrimary, ...typography.bodyBold },
    secondaryBtn: {
      backgroundColor: c.surfaceNested,
      borderRadius: radii.lg,
      paddingVertical: 14,
      alignItems: "center",
    },
    secondaryBtnText: { color: c.text, ...typography.bodyBold },
    moveBox: {
      gap: spacing.sm,
    },
    moveLabel: {
      color: c.textMuted,
      ...typography.caption,
      textTransform: "uppercase",
    },
    chipRow: {
      gap: spacing.sm,
    },
    chip: {
      backgroundColor: c.surfaceNested,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    chipOn: {
      backgroundColor: c.primaryTint,
    },
    chipText: { color: c.text, ...typography.small },
    chipTextOn: { color: c.primary, ...typography.smallBold },
    blockPick: {
      backgroundColor: c.surfaceNested,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    deleteText: {
      color: c.danger,
      ...typography.bodyBold,
      textAlign: "center",
      paddingVertical: spacing.sm,
    },
    cancelText: {
      color: c.textMuted,
      ...typography.bodyBold,
      textAlign: "center",
      paddingVertical: spacing.sm,
    },
  });
