package dev.capri.minecraft.mixin;

import dev.capri.minecraft.CapriMod;
import net.minecraft.client.render.VertexConsumerProvider;
import net.minecraft.client.render.entity.LightningEntityRenderer;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.entity.LightningEntity;
import net.minecraft.text.Text;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Unique;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.ModifyArgs;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.invoke.arg.Args;

/**
 * Capri's bolts (named {@link CapriMod#BLACKWALL}) are drawn red: the color vanilla passes to each
 * branch (a pale 0.45, 0.45, 0.5) becomes a hot Blackwall red. Every other lightning stays as it is.
 */
@Mixin(LightningEntityRenderer.class)
public abstract class LightningEntityRendererMixin {
	@Unique
	private static boolean capri$red;

	@Inject(method = "render(Lnet/minecraft/entity/LightningEntity;FFLnet/minecraft/client/util/math/MatrixStack;Lnet/minecraft/client/render/VertexConsumerProvider;I)V", at = @At("HEAD"))
	private void capri$whose(LightningEntity bolt, float yaw, float tickDelta, MatrixStack matrices, VertexConsumerProvider consumers, int light, CallbackInfo ci) {
		Text name = bolt.getCustomName();
		capri$red = name != null && CapriMod.BLACKWALL.equals(name.getString());
	}

	@ModifyArgs(method = "render(Lnet/minecraft/entity/LightningEntity;FFLnet/minecraft/client/util/math/MatrixStack;Lnet/minecraft/client/render/VertexConsumerProvider;I)V",
		at = @At(value = "INVOKE", target = "Lnet/minecraft/client/render/entity/LightningEntityRenderer;drawBranch(Lorg/joml/Matrix4f;Lnet/minecraft/client/render/VertexConsumer;FFIFFFFFFFZZZZ)V"))
	private void capri$redBranch(Args args) {
		if (!capri$red) return;
		// red, green, blue: the 8th, 9th and 10th arguments
		args.set(7, 1.0f);
		args.set(8, 0.05f);
		args.set(9, 0.12f);
	}
}
