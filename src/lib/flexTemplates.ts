export const getCouponFlex = (coupon: {
    name: string;
    description: string;
    code: string;
    expiresAt: string;
    imageUrl?: string;
}) => {
    return {
        type: "flex",
        altText: "You received a new coupon! \uD83C\uDF89",
        contents: {
            type: "bubble",
            hero: {
                type: "image",
                url: coupon.imageUrl || "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=1000&auto=format&fit=crop",
                size: "full",
                aspectRatio: "20:13",
                aspectMode: "cover",
                action: {
                    type: "uri",
                    uri: `https://liff.line.me/${import.meta.env.VITE_LIFF_ID}/wallet` // Adjust LIFF ID usage as needed
                }
            },
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: "SPECIAL REWARD",
                        weight: "bold",
                        color: "#D4AF37", // Gold
                        size: "xs"
                    },
                    {
                        type: "text",
                        text: coupon.name,
                        weight: "bold",
                        size: "xl",
                        margin: "md",
                        wrap: true
                    },
                    {
                        type: "text",
                        text: coupon.description,
                        size: "sm",
                        color: "#999999",
                        margin: "sm",
                        wrap: true
                    },
                    {
                        type: "box",
                        layout: "vertical",
                        margin: "lg",
                        spacing: "sm",
                        contents: [
                            {
                                type: "box",
                                layout: "baseline",
                                spacing: "sm",
                                contents: [
                                    {
                                        type: "text",
                                        text: "Code",
                                        color: "#aaaaaa",
                                        size: "sm",
                                        flex: 1
                                    },
                                    {
                                        type: "text",
                                        text: coupon.code,
                                        wrap: true,
                                        color: "#666666",
                                        size: "sm",
                                        flex: 5,
                                        weight: "bold"
                                    }
                                ]
                            },
                            {
                                type: "box",
                                layout: "baseline",
                                spacing: "sm",
                                contents: [
                                    {
                                        type: "text",
                                        text: "Exp",
                                        color: "#aaaaaa",
                                        size: "sm",
                                        flex: 1
                                    },
                                    {
                                        type: "text",
                                        text: coupon.expiresAt,
                                        wrap: true,
                                        color: "#666666",
                                        size: "sm",
                                        flex: 5
                                    }
                                ]
                            }
                        ]
                    }
                ]
            },
            footer: {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                contents: [
                    {
                        type: "button",
                        style: "primary",
                        height: "sm",
                        action: {
                            type: "uri",
                            label: "Use Now",
                            // Use LIFF URL to open Wallet directly
                            uri: `https://liff.line.me/${import.meta.env.VITE_LIFF_ID}/wallet`
                        },
                        color: "#1F2937" // Dark Gray
                    }
                ],
                flex: 0
            }
        }
    };
};
