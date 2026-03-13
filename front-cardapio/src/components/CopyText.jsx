import React from "react";
import { Toast } from "./Toast";

export const CopyText = ({ text }) => {
    const [showToast, setShowToast] = React.useState(false);
    
    const handle = async () => {
        await navigator.clipboard.writeText(text);
        setShowToast(true);
    }

    return (
        <>
            <strong onClick={handle}>{text}</strong>
            {showToast && (<Toast 
                message="Texto copiado para a área de transferência!" 
                onClose={() => setShowToast(false)} />
            )}
        </>
    );
}